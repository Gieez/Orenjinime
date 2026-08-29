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

    // PHASE 3: Sync schedule data
    console.log("[Sync] Phase 3: Syncing schedule...");
    try {
      const scheduleHtml = await HttpClient.getHtml(adapter.baseUrl);
      if (scheduleHtml) {
        const schedules = await adapter.getSchedule(scheduleHtml);
        for (const item of schedules) {
          try {
            await upsertSchedule(item);
          } catch (err) {
            console.error(`[Sync] Failed schedule for ${item.animeSlug}:`, err);
          }
        }
        console.log(`[Sync] Synced ${schedules.length} schedule entries.`);
      }
    } catch (err) {
      console.error("[Sync] Schedule sync failed:", err);
    }

    console.log(`[Sync] Complete. Processed ${processed} anime.`);
  } catch (error) {
    console.error("[Sync] Fatal error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

runSync();
