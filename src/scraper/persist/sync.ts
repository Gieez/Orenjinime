import { prisma } from "@/lib/prisma";
import { AnimeStatus, AnimeType } from "@prisma/client";
import { NugiAnimeAdapter } from "../adapters/nuginime-adapter";
import { HttpClient } from "../http-client";
import { logger } from "../utils/logger";

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

export class ScraperSyncService {
  private adapter: NugiAnimeAdapter;

  constructor() {
    this.adapter = new NugiAnimeAdapter();
  }

  async syncCatalog(pagesToScrape: string = "2", startPage: number = 1) {
    const totalPages = parseInt(pagesToScrape, 10) || 2;
    const allCatalogItems: any[] = [];
    let top10Items: any[] = [];
    let globalOrder = 1;

    logger.log("SCRAPER", `🚀 FASE 1: Membaca Urutan Katalog (${totalPages} Halaman) & Top 10...`);

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
        logger.log("SCRAPER", `❌ FASE 1 Error Halaman ${page}: ${error.message}`);
        break;
      }
    }

    if (allCatalogItems.length === 0 && top10Items.length === 0) {
      logger.log("SCRAPER", "⚠️ Data kosong. Dibatalkan.");
      return { success: false, processedCount: 0 };
    }

    logger.log("SCRAPER", `✅ FASE 1 Selesai. Menyiapkan database atomic transaction...`);

    // FASE 2: ATOMIC DATABASE UPDATE
    const scrapedSlugs = allCatalogItems.map((i) => i.slug);

    try {
      await prisma.$transaction(
        async (tx) => {
          // Reset latestOrder & topOrder lama jika mulai dari page 1
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

          // Save / Update Catalog Items secara sekuensial dalam transaksi agar aman dari deadlock
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

          // Save / Update Top 10 Items secara sekuensial
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
        }
      );
      logger.log("SCRAPER", `✅ FASE 2 Selesai. Homepage Frontend sekarang sudah tersinkronisasi!`);
    } catch (dbError: any) {
      logger.log("SCRAPER", `❌ FASE 2 Database Error: ${dbError.message}`);
      return { success: false, processedCount: 0 };
    }

    // FASE 3: ENRICHMENT DETAIL & EPISODE
    logger.log("SCRAPER", `🚀 FASE 3: Menarik data Detail, Episode & Video Stream...`);
    let totalProcessed = 0;

    const itemsToProcessMap = new Map<string, any>();
    [...allCatalogItems, ...top10Items].forEach((item) => {
      if (!itemsToProcessMap.has(item.slug)) {
        itemsToProcessMap.set(item.slug, item);
      }
    });

    for (const item of Array.from(itemsToProcessMap.values())) {
      await this.syncAnimeItem(item);
      totalProcessed++;
      await sleep(300);
    }

    return { success: true, processedCount: totalProcessed };
  }

  public async syncAnimeItem(item: any) {
    const sourceUrl = item.sourceUrl || item.url || `${this.adapter.baseUrl}/anime/${item.slug}/`;
    logger.log("SCRAPER", `Processing Data: ${item.title}`);

    let detailHtml = "";
    try {
      detailHtml = await HttpClient.getHtml(sourceUrl);
    } catch (err) {
      console.error(`[SCRAPER] Gagal detail ${item.slug}:`, err);
      return null;
    }

    const detail = detailHtml ? this.adapter.parseAnimeDetail(detailHtml, sourceUrl) : null;
    const parsedEpisodes = detailHtml ? this.adapter.parseEpisodeList(detailHtml, item.slug) : [];

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

    // Mengambil 3 episode paling baru (jika sudah di-sort ascending, ambil 3 dari paling belakang)
    const episodesToProcess = parsedEpisodes.slice(-3).reverse();

    for (const ep of episodesToProcess) {
      if (!ep.episodeNumber) continue;
      const releaseDate = ep.releasedAt ? new Date(ep.releasedAt) : null;

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

      if (ep.sourceUrl) {
        try {
          const epHtml = await HttpClient.getHtml(ep.sourceUrl);
          const streamSources = this.adapter.parseStreamSources(epHtml);

          if (streamSources.length > 0) {
            await prisma.streamSource.deleteMany({ where: { episodeId: episodeRecord.id } });
            await prisma.streamSource.createMany({
              data: streamSources.map((stream) => ({
                episodeId: episodeRecord.id,
                name: stream.name,
                url: stream.url,
                quality: stream.quality || "HD",
              })),
            });
          }
        } catch (streamErr) {
          console.error(`[SCRAPER] Stream error ep ${ep.episodeNumber}:`, streamErr);
        }
      }
    }
    return animeRecord;
  }
}