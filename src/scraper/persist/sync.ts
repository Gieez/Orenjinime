import { prisma } from "../../lib/prisma";
import { AnimeStatus, AnimeType } from "@prisma/client";
import { NugiAnimeAdapter } from "../adapters/nuginime-adapter";
import { HttpClient } from "../http-client";
import { logger } from "../utils/logger";
import { upsertAnime, upsertEpisode, saveStreams, upsertSchedule } from "./upsert";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeAnimeStatus(rawStatus?: string | null): AnimeStatus {
  if (!rawStatus) return AnimeStatus.ONGOING;
  const s = rawStatus.toString().trim().toUpperCase();

  if (s.includes("COMPLET") || s.includes("FINISHED") || s.includes("TAMAT")) {
    return AnimeStatus.COMPLETED;
  }
  if (s.includes("UPCOMING")) {
    return AnimeStatus.UPCOMING;
  }
  return AnimeStatus.ONGOING;
}

/**
 * Sync service — orchestrates the full sync workflow.
 *
 * Run order (matches user request: homepage first, then detail, then backfill):
 *   - syncCatalog()    → FASE 1-3 (homepage + katalog + detail + episodes + streams)
 *   - backfillStreams() → STEP B (episodes without streamSources)
 *   - syncSchedule()   → STEP C (only ongoing/active anime, all 7 days)
 *
 * Idempotency: existing episodes with streamSources are SKIPPED. New episodes
 * or episodes missing streams are SCRAPED. Skip check: if episode row exists
 * AND streamSources count > 0, skip.
 */
export class ScraperSyncService {
  private adapter: NugiAnimeAdapter;

  constructor() {
    this.adapter = new NugiAnimeAdapter();
  }

  // ============================================================
  // STEP A: HOMEPAGE-FIRST SYNC
  // ============================================================

  async syncCatalog(pagesToScrape: string = "2", startPage: number = 1) {
    const totalPages = parseInt(pagesToScrape, 10) || 2;
    const allCatalogItems: any[] = [];
    let top10Items: any[] = [];
    let globalOrder = 1;

    logger.log("SCRAPER", `🚀 STEP A1: Homepage (Top 10 + katalog ${totalPages} halaman)...`);

    // 1. Scrape Widget Top 10 dari Homepage
    try {
      const homeHtml = await HttpClient.getHtml(this.adapter.baseUrl);
      top10Items = this.adapter.parseTop10(homeHtml);
      logger.log("SCRAPER", `✅ Berhasil mengambil ${top10Items.length} data Top 10.`);
    } catch (error: any) {
      logger.log("SCRAPER", `⚠️ Gagal mengambil Top 10: ${error.message}`);
    }

    // 2. Scrape Katalog Anime Terbaru
    for (let page = startPage; page <= totalPages; page++) {
      try {
        const pageUrl =
          page === 1
            ? `${this.adapter.baseUrl}/anime-terbaru/`
            : `${this.adapter.baseUrl}/anime-terbaru/page/${page}/`;

        const html = await HttpClient.getHtml(pageUrl);
        const catalogResult = await this.adapter.scrapeCatalog(html);

        if (!catalogResult.items || catalogResult.items.length === 0) break;

        for (const item of catalogResult.items) {
          allCatalogItems.push({ ...item, latestOrder: globalOrder });
          globalOrder++;
        }
      } catch (error: any) {
        logger.log("SCRAPER", `❌ STEP A1 Error Halaman ${page}: ${error.message}`);
        break;
      }
    }

    if (allCatalogItems.length === 0 && top10Items.length === 0) {
      logger.log("SCRAPER", "⚠️ Data kosong. Dibatalkan.");
      return { success: false, processedCount: 0 };
    }

    logger.log(
      "SCRAPER",
      `✅ STEP A1 Selesai. Katalog: ${allCatalogItems.length}, Top 10: ${top10Items.length}. Upsert ke DB...`,
    );

    // FASE 2: ATOMIC DATABASE UPDATE (catalog + top 10 metadata)
    const scrapedSlugs = allCatalogItems.map((i) => i.slug);

    try {
      await prisma.$transaction(
        async (tx: any) => {
          if (startPage === 1) {
            await tx.anime.updateMany({
              where: {
                latestOrder: { not: null },
                ...(scrapedSlugs.length > 0 ? { slug: { notIn: scrapedSlugs } } : {}),
              },
              data: { latestOrder: null },
            });

            await tx.anime.updateMany({
              where: { topOrder: { not: null } },
              data: { topOrder: null },
            });
          }

          for (const item of allCatalogItems) {
            const sourceUrl = item.sourceUrl || `${this.adapter.baseUrl}/anime/${item.slug}/`;
            await tx.anime.upsert({
              where: { slug: item.slug },
              update: {
                title: item.title,
                poster: item.poster,
                latestOrder: item.latestOrder,
              },
              create: {
                slug: item.slug,
                title: item.title,
                poster: item.poster,
                status: normalizeAnimeStatus(item.status),
                type: item.type || AnimeType.TV,
                sourceUrl: sourceUrl,
                latestOrder: item.latestOrder,
              },
            });
          }

          for (const item of top10Items) {
            const sourceUrl = item.url || `${this.adapter.baseUrl}/anime/${item.slug}/`;
            await tx.anime.upsert({
              where: { slug: item.slug },
              update: {
                topOrder: item.rank,
                rating: item.rating || undefined,
                ...(item.poster ? { poster: item.poster } : {}),
              },
              create: {
                slug: item.slug,
                title: item.title,
                poster: item.poster,
                topOrder: item.rank,
                rating: item.rating || undefined,
                status: AnimeStatus.ONGOING,
                type: AnimeType.TV,
                sourceUrl: sourceUrl,
              },
            });
          }
        },
        {
          maxWait: 10000,
          timeout: 30000,
        },
      );
      logger.log("SCRAPER", `✅ STEP A2 Selesai. Anime metadata ter-update.`);
    } catch (dbError: any) {
      logger.log("SCRAPER", `❌ STEP A2 Database Error: ${dbError.message}`);
      return { success: false, processedCount: 0 };
    }

    // FASE 3: ENRICHMENT — detail + ALL episodes + streams
    logger.log(
      "SCRAPER",
      `🚀 STEP A3: Detail + episode + stream untuk ${allCatalogItems.length + top10Items.length} anime...`,
    );
    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalNewEpisodes = 0;
    let totalNewStreams = 0;

    const itemsToProcessMap = new Map<string, any>();
    [...allCatalogItems, ...top10Items].forEach((item) => {
      if (!itemsToProcessMap.has(item.slug)) {
        itemsToProcessMap.set(item.slug, item);
      }
    });

    for (const item of Array.from(itemsToProcessMap.values())) {
      const result = await this.syncAnimeItem(item);
      if (result) {
        totalProcessed++;
        totalNewEpisodes += result.newEpisodes || 0;
        totalNewStreams += result.newStreams || 0;
      } else {
        totalSkipped++;
      }
      await sleep(500);
    }

    logger.log(
      "SCRAPER",
      `✅ STEP A selesai. Processed: ${totalProcessed}, Skipped: ${totalSkipped}, New episodes: ${totalNewEpisodes}, New streams: ${totalNewStreams}.`,
    );

    return { success: true, processedCount: totalProcessed, totalNewEpisodes, totalNewStreams };
  }

  /**
   * Process a single anime — scrape detail, parse ALL episodes, scrape
   * streams for any episode that doesn't have them yet. Idempotent.
   *
   * Skip conditions:
   *  - If ALL episodes in detail page already exist in DB AND have streamSources,
   *    skip everything (no API call needed for streams).
   *
   * Otherwise:
   *  - Upsert detail metadata (synopsis, rating, status, etc.)
   *  - For each episode in detail:
   *    - If episode exists in DB with streamSources: skip (already done)
   *    - Else: upsert episode + scrape episode page + save streams
   */
  public async syncAnimeItem(item: any) {
    const sourceUrl = item.sourceUrl || item.url || `${this.adapter.baseUrl}/anime/${item.slug}/`;
    logger.log("SCRAPER", `Processing: ${item.title}`);

    let detailHtml = "";
    try {
      detailHtml = await HttpClient.getHtml(sourceUrl);
    } catch (err) {
      console.error(`[SCRAPER] Gagal detail ${item.slug}:`, err);
      return null;
    }

    if (!detailHtml) return null;

    const detail = this.adapter.parseAnimeDetail(detailHtml, sourceUrl);
    const parsedEpisodes = this.adapter.parseEpisodeList(detailHtml, item.slug);

    const rawStatus = detail?.status || item.status;
    const finalStatus = normalizeAnimeStatus(rawStatus);

    let latestRelease: Date | null = null;
    parsedEpisodes.forEach((ep) => {
      if (ep.releasedAt) {
        const epDate = new Date(ep.releasedAt);
        if (!latestRelease || epDate > latestRelease) {
          latestRelease = epDate;
        }
      }
    });

    // Quick check: do we have ALL episodes in DB and all have streams?
    const existing = await prisma.anime.findUnique({
      where: { slug: item.slug },
      include: { episodes: { include: { streamSources: { select: { id: true } } } } },
    });

    if (existing && parsedEpisodes.length > 0) {
      const existingByNum = new Map<number, { hasStream: boolean }>();
      for (const e of existing.episodes) {
        existingByNum.set(e.episodeNumber, { hasStream: e.streamSources.length > 0 });
      }

      const allEpisodesKnown = parsedEpisodes.every(
        (ep) => existingByNum.has(ep.episodeNumber) && existingByNum.get(ep.episodeNumber)!.hasStream,
      );

      if (allEpisodesKnown) {
        // Update metadata only (rating, synopsis may have changed) — no streams to re-scrape
        await prisma.anime.update({
          where: { slug: item.slug },
          data: {
            rating: detail?.rating ?? undefined,
            synopsis: detail?.synopsis,
            studio: detail?.studio,
            status: finalStatus,
            latestEpisodeRelease: latestRelease || undefined,
          },
        });
        return { newEpisodes: 0, newStreams: 0, skipped: true };
      }
    }

    // Update metadata
    const animeRecord = await prisma.anime.update({
      where: { slug: item.slug },
      data: {
        rating: detail?.rating ?? undefined,
        synopsis: detail?.synopsis,
        studio: detail?.studio,
        status: finalStatus,
        latestEpisodeRelease: latestRelease || undefined,
      },
    });

    // Process ALL episodes from detail (not just 3 latest)
    let newEpisodes = 0;
    let newStreams = 0;

    for (const ep of parsedEpisodes) {
      if (!ep.episodeNumber) continue;
      const releaseDate = ep.releasedAt ? new Date(ep.releasedAt) : null;

      // Check if episode already exists with streams
      const existingEp = await prisma.episode.findUnique({
        where: {
          animeId_episodeNumber: { animeId: animeRecord.id, episodeNumber: ep.episodeNumber },
        },
        include: { streamSources: { select: { id: true } } },
      });

      if (existingEp && existingEp.streamSources.length > 0) {
        // Already have streams — just update metadata if needed
        if (ep.title || ep.sourceUrl || releaseDate) {
          await prisma.episode.update({
            where: { id: existingEp.id },
            data: {
              title: ep.title,
              sourceUrl: ep.sourceUrl,
              releasedAt: releaseDate,
              lastScrapedAt: new Date(),
            },
          });
        }
        continue;
      }

      // Need to create or update episode + scrape streams
      const episodeRecord = await prisma.episode.upsert({
        where: {
          animeId_episodeNumber: { animeId: animeRecord.id, episodeNumber: ep.episodeNumber },
        },
        update: {
          title: ep.title,
          sourceUrl: ep.sourceUrl,
          releasedAt: releaseDate,
          lastScrapedAt: new Date(),
        },
        create: {
          animeId: animeRecord.id,
          episodeNumber: ep.episodeNumber,
          title: ep.title,
          sourceUrl: ep.sourceUrl,
          releasedAt: releaseDate,
          lastScrapedAt: new Date(),
        },
      });
      newEpisodes++;

      if (ep.sourceUrl) {
        try {
          const epHtml = await HttpClient.getHtml(ep.sourceUrl);
          const streamSources = this.adapter.parseStreamSources(epHtml);

          if (streamSources.length > 0) {
            // Resolve proxy URLs to direct iframe URLs (bypasses Cloudflare
            // blocking on Vercel serverless IPs at runtime)
            const proxyUrls = streamSources
              .map((s) => s.url)
              .filter((u) => u.startsWith("/api/player/embed"));
            const resolved = await this.adapter.resolveStreamUrls(proxyUrls);

            const finalStreams = streamSources.map((s) => ({
              ...s,
              url: resolved.get(s.url) || s.url,
            }));

            await prisma.streamSource.deleteMany({ where: { episodeId: episodeRecord.id } });
            await prisma.streamSource.createMany({
              data: finalStreams.map((stream) => ({
                episodeId: episodeRecord.id,
                name: stream.name,
                url: stream.url,
                quality: stream.quality || "HD",
              })),
            });
            newStreams += finalStreams.length;
          }
        } catch (streamErr) {
          console.error(`[SCRAPER] Stream error ep ${ep.episodeNumber}:`, streamErr);
        }
      }
    }

    return { newEpisodes, newStreams, skipped: false };
  }

  // ============================================================
  // STEP B: BACKFILL — anime in DB with episodes but no streams
  // ============================================================

  /**
   * Find all anime whose episodes are missing streamSources and try to
   * scrape them. Skip anime that already have streams everywhere.
   *
   * This handles the case where an anime was added to DB but its episodes
   * never had streams (e.g. from older sync runs that only did 3 episodes).
   */
  async backfillStreams(maxAnime: number = 100) {
    logger.log("SCRAPER", `🚀 STEP B: Backfill streams untuk anime tanpa streams...`);

    // Find anime with at least one episode without streams
    const candidates = await prisma.anime.findMany({
      where: {
        episodes: { some: { streamSources: { none: {} } } },
      },
      include: {
        episodes: {
          where: { streamSources: { none: {} } },
          select: { id: true, episodeNumber: true, sourceUrl: true },
        },
      },
      take: maxAnime,
    });

    logger.log(
      "SCRAPER",
      `  Found ${candidates.length} anime needing backfill.`,
    );

    let totalEpisodesProcessed = 0;
    let totalStreamsAdded = 0;
    let totalFailed = 0;

    for (const anime of candidates) {
      logger.log(
        "SCRAPER",
        `  Backfilling ${anime.title} (${anime.episodes.length} eps without streams)...`,
      );

      for (const ep of anime.episodes) {
        if (!ep.sourceUrl) {
          // Try to construct sourceUrl from slug if missing
          const sourceUrl = `${this.adapter.baseUrl}/anime/${anime.slug}-episode-${ep.episodeNumber}/`;
          await prisma.episode.update({
            where: { id: ep.id },
            data: { sourceUrl },
          });
          ep.sourceUrl = sourceUrl;
        }

        try {
          const epHtml = await HttpClient.getHtml(ep.sourceUrl);
          const streamSources = this.adapter.parseStreamSources(epHtml);

          if (streamSources.length > 0) {
            const proxyUrls = streamSources
              .map((s) => s.url)
              .filter((u) => u.startsWith("/api/player/embed"));
            const resolved = await this.adapter.resolveStreamUrls(proxyUrls);

            const finalStreams = streamSources.map((s) => ({
              ...s,
              url: resolved.get(s.url) || s.url,
            }));

            await prisma.streamSource.deleteMany({ where: { episodeId: ep.id } });
            await prisma.streamSource.createMany({
              data: finalStreams.map((stream) => ({
                episodeId: ep.id,
                name: stream.name,
                url: stream.url,
                quality: stream.quality || "HD",
              })),
            });
            totalStreamsAdded += finalStreams.length;
            totalEpisodesProcessed++;
          } else {
            totalFailed++;
          }
        } catch (err) {
          totalFailed++;
          console.error(`[SCRAPER] Backfill failed ${anime.slug} ep ${ep.episodeNumber}:`, err);
        }
        await sleep(800);
      }
    }

    logger.log(
      "SCRAPER",
      `✅ STEP B selesai. Episodes processed: ${totalEpisodesProcessed}, streams added: ${totalStreamsAdded}, failed: ${totalFailed}.`,
    );

    return {
      success: true,
      animeProcessed: candidates.length,
      episodesProcessed: totalEpisodesProcessed,
      streamsAdded: totalStreamsAdded,
      failed: totalFailed,
    };
  }

  // ============================================================
  // STEP C: SCHEDULE — only ongoing anime
  // ============================================================

  /**
   * Sync release schedule. Samehadaku's /jadwal/ page returns all 7 days
   * in a single response. We only upsert entries for anime that exist in
   * DB AND are ongoing/active — completed anime are dropped from schedule
   * (they don't get new air times).
   */
  async syncSchedule() {
    logger.log("SCRAPER", "🚀 STEP C: Schedule sync (all 7 days, ongoing only)...");

    try {
      const url = this.adapter.scheduleUrl("all");
      const html = await HttpClient.getHtml(url);
      if (!html) {
        logger.log("SCRAPER", "❌ STEP C: Failed to fetch /jadwal/ page.");
        return { success: false };
      }

      const allSchedules = await this.adapter.getSchedule(html);

      // Filter: only keep schedules where anime exists in DB and is ongoing
      const slugs: string[] = [
        ...new Set(
          allSchedules
            .map((s) => s.animeSlug)
            .filter((s): s is string => typeof s === "string" && s.length > 0),
        ),
      ];
      const animeInDb = await prisma.anime.findMany({
        where: { slug: { in: slugs } },
        select: { slug: true, status: true },
      });
      const ongoingSlugs = new Set(
        animeInDb.filter((a: any) => a.status === AnimeStatus.ONGOING).map((a: any) => a.slug),
      );

      let totalSynced = 0;
      let totalSkipped = 0;
      for (const item of allSchedules) {
        if (!item.animeSlug || !ongoingSlugs.has(item.animeSlug)) {
          totalSkipped++;
          continue;
        }
        try {
          await upsertSchedule(item);
          totalSynced++;
        } catch (err) {
          console.error(`[SCRAPER] Schedule failed ${item.animeSlug}:`, err);
        }
      }

      logger.log(
        "SCRAPER",
        `✅ STEP C selesai. Synced: ${totalSynced}, skipped (not ongoing/missing): ${totalSkipped}.`,
      );

      return { success: true, synced: totalSynced, skipped: totalSkipped };
    } catch (err) {
      logger.log("SCRAPER", `❌ STEP C error: ${err instanceof Error ? err.message : String(err)}`);
      return { success: false };
    }
  }
}
