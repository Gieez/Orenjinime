/**
 * FULL BACKFILL — Scrape semua anime di DB dari Samehadaku
 * 
 * Flow:
 * 1. Ambil semua anime yang punya sourceUrl
 * 2. Scrape detail page → update synopsis (ganti "Samehadaku" → "Orenjinime"), genres, studio, rating
 * 3. Scrape episode list → upsert episodes
 * 4. Scrape stream source untuk latest 5 episode yang belum punya stream
 * 
 * Rate limit: 2 detik antar request
 * Estimasi: ~84 menit untuk 507 anime
 */

import { PrismaClient } from "@prisma/client";
import { NugiAnimeAdapter } from "../src/scraper/adapters/nuginime-adapter";
import { HttpClient } from "../src/scraper/http-client";
import { upsertAnime, upsertEpisodes } from "../src/scraper/persist/upsert";

const prisma = new PrismaClient();
const adapter = new NugiAnimeAdapter();

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

// Replace Samehadaku → Orenjinime di synopsis
function cleanSynopsis(synopsis: string | null | undefined): string | null {
  if (!synopsis) return null;
  return synopsis
    .replace(/Samehadaku/gi, "Orenjinime")
    .replace(/samehadaku/gi, "Orenjinime")
    .replace(/samehadaku\.how/gi, "orenjinime.vercel.app")
    .trim();
}

// Normalisasi status
function normalizeStatus(raw?: string | null): string {
  if (!raw) return "ONGOING";
  const s = raw.toUpperCase();
  if (s.includes("COMPLET") || s.includes("FINISH") || s.includes("TAMAT")) return "COMPLETED";
  if (s.includes("UPCOMING")) return "UPCOMING";
  return "ONGOING";
}

async function main() {
  const startTime = Date.now();

  // Ambil semua anime yang punya sourceUrl
  const allAnime = await prisma.anime.findMany({
    where: { sourceUrl: { not: null } },
    select: {
      id: true,
      slug: true,
      title: true,
      sourceUrl: true,
      synopsis: true,
      lastScrapedAt: true,
    },
    orderBy: { latestOrder: "asc" },
  });

  console.log(`[Backfill] Total anime perlu di-scrape: ${allAnime.length}`);
  console.log(`[Backfill] Estimasi: ~${Math.round(allAnime.length * 3.5 / 60)} menit`);
  console.log(`[Backfill] Mulai: ${new Date().toISOString()}`);
  console.log("---");

  let successCount = 0;
  let errorCount = 0;
  let streamCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < allAnime.length; i++) {
    const anime = allAnime[i];
    const progress = `[${i + 1}/${allAnime.length}]`;
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const eta = Math.round(((allAnime.length - i - 1) * 3.5));
    const etaMin = Math.round(eta / 60);

    console.log(`\n${progress} ${anime.title} (${anime.slug}) — ETA ~${etaMin}m — ${elapsed}s elapsed`);

    try {
      // 1. Scrape detail page
      const detailHtml = await HttpClient.getHtml(anime.sourceUrl!);
      const detailData = adapter.parseAnimeDetail(detailHtml, anime.sourceUrl!);
      const episodeList = adapter.parseEpisodeList(detailHtml, anime.slug);

      // Clean synopsis
      const cleanedSynopsis = cleanSynopsis(detailData.synopsis);

      // 2. Upsert anime detail
      await upsertAnime({
        ...detailData,
        slug: anime.slug,
        synopsis: cleanedSynopsis,
        sourceUrl: anime.sourceUrl!,
      });
      console.log(`  Detail OK — synopsis: ${cleanedSynopsis ? cleanedSynopsis.substring(0, 80) + "..." : "N/A"}`);

      // 3. Upsert episodes
      if (episodeList.length > 0) {
        await upsertEpisodes(anime.id, episodeList);
        console.log(`  Episodes: ${episodeList.length} ditemukan`);
      } else {
        console.log(`  Episodes: 0 (skip)`);
      }

      // 4. Scrape stream untuk latest 5 episode yang belum punya stream
      const epsWithoutStreams = await prisma.episode.findMany({
        where: {
          animeId: anime.id,
          streamSources: { none: {} },
        },
        orderBy: { episodeNumber: "desc" },
        take: 5,
      });

      if (epsWithoutStreams.length > 0) {
        console.log(`  Scraping stream untuk ${epsWithoutStreams.length} episode...`);
        for (const ep of epsWithoutStreams) {
          try {
            const url = ep.sourceUrl;
            if (!url) continue;

            const epHtml = await HttpClient.getHtml(url);
            const streams = adapter.parseStreamSources(epHtml);

            if (streams.length > 0) {
              // Hapus stream lama, simpan baru
              await prisma.streamSource.deleteMany({ where: { episodeId: ep.id } });
              await prisma.streamSource.createMany({
                data: streams.map((s) => ({
                  episodeId: ep.id,
                  name: s.name,
                  url: s.url,
                  quality: s.quality || "HD",
                  type: s.type || "embed",
                })),
              });
              streamCount += streams.length;
              console.log(`    Ep ${ep.episodeNumber}: ${streams.length} streams`);
            } else {
              console.log(`    Ep ${ep.episodeNumber}: 0 streams`);
            }
          } catch (err: any) {
            console.log(`    Ep ${ep.episodeNumber}: error — ${err.message}`);
          }
          await sleep(2000);
        }
      }

      // Update lastScrapedAt
      await prisma.anime.update({
        where: { id: anime.id },
        data: { lastScrapedAt: new Date() },
      });

      successCount++;
      console.log(`  DONE ✓`);
    } catch (err: any) {
      errorCount++;
      console.error(`  ERROR ✗ — ${err.message}`);
    }

    // Rate limit
    await sleep(2000);
  }

  // Summary
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  const totalTimeMin = Math.round(totalTime / 60);

  console.log("\n========================================");
  console.log(`[Backfill] SELESAI!`);
  console.log(`  Waktu total: ${totalTimeMin} menit (${totalTime}s)`);
  console.log(`  Berhasil: ${successCount}`);
  console.log(`  Gagal: ${errorCount}`);
  console.log(`  Stream ditambahkan: ${streamCount}`);
  console.log(`  Selesai: ${new Date().toISOString()}`);
  console.log("========================================");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[Backfill] Fatal error:", err);
  prisma.$disconnect();
  process.exit(1);
});
