import { prisma } from "../src/lib/prisma";
import { HttpClient } from "../src/scraper/http-client";
import { NugiAnimeAdapter } from "../src/scraper/adapters/nuginime-adapter";
import { upsertAnime, upsertEpisodes, upsertSchedule } from "../src/scraper/persist/upsert";

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function runSync() {
  console.log("[Sync] Starting anime & episode synchronization...");

  try {
    const adapter = new NugiAnimeAdapter();

    // PHASE 1: Sync homepage catalog (latest episodes)
    console.log("[Sync] Phase 1: Scraping homepage catalog...");
    const homeHtml = await HttpClient.getHtml(adapter.baseUrl);

    if (!homeHtml) {
      console.error("[Sync] Failed to fetch homepage HTML.");
      return;
    }

    const animeList = adapter.parseHomepage(homeHtml);
    console.log(`[Sync] Found ${animeList.length} anime from homepage.`);

    let processed = 0;
    for (const item of animeList) {
      console.log(`[Sync] Scraping detail: ${item.title} (${item.slug})`);

      try {
        const detailHtml = await HttpClient.getHtml(item.sourceUrl);
        if (detailHtml) {
          const detailData = adapter.parseAnimeDetail(detailHtml, item.sourceUrl);
          const episodeList = adapter.parseEpisodeList(detailHtml);

          const saved = await upsertAnime({
                      ...detailData,
                      slug: item.slug,
                      latestOrder: item.latestOrder,
                    });

          if (episodeList.length > 0) {
            await upsertEpisodes(saved.id, episodeList);
            console.log(`[Sync] OK ${item.title}: ${episodeList.length} episodes.`);
          }
          processed++;
        }
      } catch (err) {
        console.error(`[Sync] Failed detail ${item.slug}:`, err);
      }

      // Rate limit: 2s between requests
      await sleep(2000);
    }

    // PHASE 2: Sync Top 10
    console.log("[Sync] Phase 2: Syncing Top 10...");
    try {
      const top10 = adapter.parseTop10(homeHtml);
      for (const item of top10) {
        try {
          await upsertAnime({
            title: item.title,
            slug: item.slug,
            poster: item.poster,
            rating: item.rating,
            sourceUrl: item.url,
            status: "ONGOING" as any,
            topOrder: item.rank,
            genres: [],
            producers: [],
          } as any);
        } catch (err) {
          console.error(`[Sync] Failed Top10 ${item.slug}:`, err);
        }
        await sleep(500);
      }
      console.log(`[Sync] Synced ${top10.length} Top 10 entries.`);
    } catch (err) {
      console.error("[Sync] Top 10 sync failed:", err);
    }

    // PHASE 3: Sync schedule data (SEMUA hari dari WP-JSON API)
        console.log("[Sync] Phase 3: Syncing schedule (all days)...");
        try {
          const DAY_URL_MAP: Record<string, string> = {
                  Monday: "monday",
                  Tuesday: "tuesday",
                  Wednesday: "wednesday",
                  Thursday: "thursday",
                  Friday: "friday",
                  Saturday: "saturday",
                  Sunday: "sunday",
                };

                const DAY_NAME_TO_NUM: Record<string, number> = {
                  Monday: 1,
                  Tuesday: 2,
                  Wednesday: 3,
                  Thursday: 4,
                  Friday: 5,
                  Saturday: 6,
                  Sunday: 0,
                };

                let totalCount = 0;
                for (const [dayName, daySlug] of Object.entries(DAY_URL_MAP)) {
                  try {
                    const raw = await HttpClient.getJson(
                      `https://v2.samehadaku.how/wp-json/custom/v1/all-schedule?perpage=500&day=${daySlug}`
                    );
              const items = JSON.parse(raw) as Array<{
                slug: string;
                title: string;
                url: string;
                featured_img_src: string | null;
                east_time: string | null;
              }>;

              for (const item of items) {
                try {
                  // Upsert anime jika belum ada
                  let anime = await prisma.anime.findUnique({ where: { slug: item.slug } });
                  if (!anime) {
                    const cleanTitle = item.title.replace(/\s*Sub\s*Indo\s*$/i, "").trim();
                    anime = await prisma.anime.create({
                      data: {
                        title: cleanTitle,
                        slug: item.slug,
                        poster: item.featured_img_src,
                        status: "ONGOING",
                        type: "TV",
                        sourceUrl: item.url,
                      },
                    });
                  }

                  // Parse jam
                  const timeMatch = item.east_time?.match(/(\d{1,2}[:.]\d{2})/);
                  const airTime = timeMatch ? timeMatch[1].replace(".", ":") : item.east_time || "00:00";

                  const dayNum = DAY_NAME_TO_NUM[dayName] ?? 1;
                                // Upsert schedule
                                    await prisma.schedule.upsert({
                                      where: {
                                        animeId_dayOfWeek: { animeId: anime.id, dayOfWeek: dayNum },
                                      },
                                      update: { airTime },
                                      create: {
                                        animeId: anime.id,
                                        dayOfWeek: dayNum,
                                        airTime,
                                      },
                                    });
                  totalCount++;
                } catch (err) {
                  console.error(`[Sync] Failed schedule ${item.slug}:`, err);
                }
              }
              console.log(`[Sync] ${daySlug}: ${items.length} items`);
            } catch (err) {
              console.error(`[Sync] Failed fetch ${daySlug} schedule:`, err);
            }
          }
          console.log(`[Sync] Synced ${totalCount} schedule entries total.`);
        } catch (err) {
          console.error("[Sync] Schedule sync failed:", err);
        }

    // PHASE 4: Scrape episodes untuk anime yang belum punya episode
    console.log("[Sync] Phase 4: Scraping episodes untuk anime tanpa episode...");
    try {
      const animeWithoutEpisodes = await prisma.anime.findMany({
        where: {
          sourceUrl: { not: null },
          episodes: { none: {} },
        },
        select: {
          id: true,
          slug: true,
          title: true,
          sourceUrl: true,
          lastScrapedAt: true,
        },
        take: 200, // Batasi per run biar ga timeout
      });

      console.log(`[Sync] Ditemukan ${animeWithoutEpisodes.length} anime tanpa episode.`);

      let episodeCount = 0;
      for (const anime of animeWithoutEpisodes) {
        // Skip kalau baru di-scrape < 1 jam lalu
        if (anime.lastScrapedAt) {
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          if (anime.lastScrapedAt > oneHourAgo) continue;
        }

        console.log(`[Sync] Scraping episodes: ${anime.title} (${anime.slug})`);

        try {
          const detailHtml = await HttpClient.getHtml(anime.sourceUrl!);
          if (detailHtml) {
            const episodeList = adapter.parseEpisodeList(detailHtml, anime.slug);

            if (episodeList.length > 0) {
              await upsertEpisodes(anime.id, episodeList);
              console.log(`[Sync] OK ${anime.title}: ${episodeList.length} episodes.`);
              episodeCount++;
            }
          }
        } catch (err) {
          console.error(`[Sync] Failed episodes ${anime.slug}:`, err);
        }

        // Update lastScrapedAt supaya ga scrape lagi terlalu sering
        try {
          await prisma.anime.update({
            where: { id: anime.id },
            data: { lastScrapedAt: new Date() },
          });
        } catch {}

        await sleep(2000); // Rate limit
      }

      console.log(`[Sync] Phase 4 selesai: ${episodeCount} anime mendapat episode.`);
    } catch (err) {
      console.error("[Sync] Phase 4 failed:", err);
    }

    console.log(`[Sync] Complete. Processed ${processed} anime.`);
  } catch (error) {
    console.error("[Sync] Fatal error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

runSync();
