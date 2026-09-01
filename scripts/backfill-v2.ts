/**
 * FULL BACKFILL v2 — Scrape semua anime di DB (detail + episodes + streams)
 * 
 * Yang di-scrape: SEMUA anime yang udah ada di DB + punya sourceUrl
 * Yang di-skip: anime yang belum ada di DB (biar auto sync urus)
 * 
 * Per anime:
 * 1. Scrape detail page → update synopsis (ganti "Samehadaku" → "Orenjinime")
 * 2. Scrape episode list → upsert episodes  
 * 3. Scrape stream source untuk SEMUA episode yang belum punya stream
 * 
 * Rate limit: 2 detik antar request
 */

import { PrismaClient } from "@prisma/client";
import { NugiAnimeAdapter } from "../src/scraper/adapters/nuginime-adapter";
import { HttpClient } from "../src/scraper/http-client";
import { upsertAnime, upsertEpisodes } from "../src/scraper/persist/upsert";

const prisma = new PrismaClient();
const adapter = new NugiAnimeAdapter();

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

function cleanSynopsis(synopsis: string | null | undefined): string | null {
  if (!synopsis) return null;
  return synopsis
    .replace(/Samehadaku/gi, "Orenjinime")
    .replace(/samehadaku/gi, "Orenjinime")
    .replace(/samehadaku\.how/gi, "orenjinime.vercel.app")
    .trim();
}

// Progress tracking
let totalStreamScraped = 0;
let totalStreamErrors = 0;
const startTime = Date.now();

function elapsed(): string {
  const s = Math.round((Date.now() - startTime) / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

async function scrapeStreamsForAnime(animeId: string, animeSlug: string) {
  // Cari semua episode yang BELUM punya stream
  const epsWithoutStreams = await prisma.episode.findMany({
    where: {
      animeId,
      streamSources: { none: {} },
    },
    orderBy: { episodeNumber: "asc" },
  });

  if (epsWithoutStreams.length === 0) return 0;

  let scraped = 0;
  for (const ep of epsWithoutStreams) {
    const url = ep.sourceUrl;
    if (!url) continue;

    try {
      const epHtml = await HttpClient.getHtml(url);
      const streams = adapter.parseStreamSources(epHtml);

      if (streams.length > 0) {
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
        scraped += streams.length;
        totalStreamScraped += streams.length;
      }
    } catch (err: any) {
      totalStreamErrors++;
      // silent — rate limit atau halaman ga bisa diakses
    }
    await sleep(2000);
  }

  return scraped;
}

async function main() {
  console.log(`[Backfill v2] Mulai: ${new Date().toISOString()}`);

  // Ambil SEMUA anime yang udah ada di DB + punya sourceUrl
  const allAnime = await prisma.anime.findMany({
    where: { sourceUrl: { not: null } },
    select: {
      id: true,
      slug: true,
      title: true,
      sourceUrl: true,
      synopsis: true,
    },
    orderBy: { latestOrder: "asc" },
  });

  // Hitung episode per anime buat skip long-running
  const epCounts = await prisma.episode.groupBy({
    by: ["animeId"],
    _count: { id: true },
  });
  const epCountMap = new Map<string, number>();
  for (const row of epCounts) {
    epCountMap.set(row.animeId, row._count.id);
  }

  const MAX_EPS = 100; // Skip anime dengan >100 episode (long-running)
  const filtered = allAnime.filter((a) => {
    const count = epCountMap.get(a.id) || 0;
    return count <= MAX_EPS;
  });
  const skippedLong = allAnime.length - filtered.length;

  console.log(`[Backfill v2] Total anime di DB: ${allAnime.length}`);
  console.log(`[Backfill v2] Skip long-running (>${MAX_EPS} eps): ${skippedLong} anime`);
  console.log(`[Backfill v2] Akan di-scrape: ${filtered.length} anime`);
  console.log(`[Backfill v2] Estimasi: ~${Math.round(filtered.length * 4 / 60)} menit`);
  console.log("---");

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < filtered.length; i++) {
    const anime = filtered[i];
    const progress = `[${i + 1}/${filtered.length}]`;
    const eta = Math.round(((filtered.length - i - 1) * 4) / 60);
    const epCount = epCountMap.get(anime.id) || 0;

    console.log(`\n${progress} ${anime.title} (${epCount} eps) — ETA ~${eta}m — ${elapsed()}`);

    try {
      // 1. Scrape detail page
      const detailHtml = await HttpClient.getHtml(anime.sourceUrl!);
      const detailData = adapter.parseAnimeDetail(detailHtml, anime.sourceUrl!);
      const episodeList = adapter.parseEpisodeList(detailHtml, anime.slug);

      const cleanedSynopsis = cleanSynopsis(detailData.synopsis);

      // 2. Upsert anime detail + synopsis
      await upsertAnime({
        ...detailData,
        slug: anime.slug,
        synopsis: cleanedSynopsis,
        sourceUrl: anime.sourceUrl!,
      });

      // 3. Upsert episodes
      if (episodeList.length > 0) {
        await upsertEpisodes(anime.id, episodeList);
      }

      // 4. Scrape streams untuk SEMUA episode yang belum punya stream
      const streamCount = await scrapeStreamsForAnime(anime.id, anime.slug);

      // Update lastScrapedAt
      await prisma.anime.update({
        where: { id: anime.id },
        data: { lastScrapedAt: new Date() },
      });

      successCount++;
      console.log(`  OK — eps: ${episodeList.length}, streams baru: ${streamCount}, total stream: ${totalStreamScraped}`);
    } catch (err: any) {
      errorCount++;
      console.error(`  ERROR — ${err.message}`);
    }

    await sleep(2000);
  }

  // Summary
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log("\n========================================");
  console.log(`[Backfill v2] SELESAI!`);
  console.log(`  Waktu: ${Math.round(totalTime / 60)} menit (${totalTime}s)`);
  console.log(`  Berhasil: ${successCount}`);
  console.log(`  Gagal: ${errorCount}`);
  console.log(`  Skip long-running: ${skippedLong} anime (>${MAX_EPS} eps)`);
  console.log(`  Total stream ditambahkan: ${totalStreamScraped}`);
  console.log(`  Total stream errors: ${totalStreamErrors}`);
  console.log(`  Selesai: ${new Date().toISOString()}`);
  console.log("========================================");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[Backfill v2] Fatal error:", err);
  prisma.$disconnect();
  process.exit(1);
});
