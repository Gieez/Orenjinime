/**
 * Auto-scrape stream sources untuk satu episode.
 * Cuma scrape SEKALI — kalau udah pernah di-scrape (lastScrapedAt ada) dan kosong,
 * tampilkan "tidak tersedia" tanpa retry.
 */
import { prisma } from "@/lib/prisma";
import { HttpClient } from "@/scraper/http-client";
import { NugiAnimeAdapter } from "@/scraper/adapters/nuginime-adapter";

const adapter = new NugiAnimeAdapter();

export async function autoScrapeStreamsIfNeeded(episodeId: string): Promise<boolean> {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { streamSources: { take: 1 } },
  });

  if (!episode) return false;

  // Kalau stream udah ada, ga perlu scrape
  if (episode.streamSources.length > 0) return true;

  // Kalau udah pernah di-scrape tapi tetap kosong → jangan retry
  if (episode.lastScrapedAt) return false;

  // Kalau ga ada sourceUrl, ga bisa scrape
  if (!episode.sourceUrl) return false;

  console.log(`[AutoScrape] Stream kosong untuk episode ${episode.episodeNumber}, scraping...`);

  try {
    const html = await HttpClient.getHtml(episode.sourceUrl);
    const result = adapter.parseEpisodePage(html);

    if (result.streamSources.length === 0) {
      // Tandai udah di-scrape meskipun kosong — biar ga retry lagi
      await prisma.episode.update({
        where: { id: episodeId },
        data: { lastScrapedAt: new Date() },
      });
      console.log(`[AutoScrape] Episode ${episode.episodeNumber} — 0 stream sources.`);
      return false;
    }

    // Simpan stream sources
    await prisma.streamSource.createMany({
      data: result.streamSources.map((s) => ({
        episodeId: episode.id,
        name: s.name,
        url: s.url,
        type: s.type,
        quality: s.quality || null,
      })),
    });

    // Tandai udah di-scrape
    await prisma.episode.update({
      where: { id: episodeId },
      data: { lastScrapedAt: new Date() },
    });

    console.log(`[AutoScrape] Episode ${episode.episodeNumber} — ${result.streamSources.length} streams tersimpan.`);
    return true;
  } catch (err) {
    console.error(`[AutoScrape] Gagal scrape episode ${episode.episodeNumber}:`, err);
    // Tetap tandai supaya ga retry terus
    await prisma.episode.update({
      where: { id: episodeId },
      data: { lastScrapedAt: new Date() },
    });
    return false;
  }
}
