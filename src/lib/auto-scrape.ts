/**
 * Auto-scrape anime detail + episode list dari Samehadaku.
 * Dipanggil kalau anime udah di DB tapi episode-nya kosong.
 * Cuma scrape SEKALI — kalau tetap kosong, biarin.
 */
import { prisma } from "@/lib/prisma";
import { HttpClient } from "@/scraper/http-client";
import { NugiAnimeAdapter } from "@/scraper/adapters/nuginime-adapter";

const adapter = new NugiAnimeAdapter();

export async function autoScrapeAnimeIfNeeded(slug: string): Promise<boolean> {
  const anime = await prisma.anime.findUnique({
    where: { slug },
    include: { episodes: { take: 1 } },
  });

  if (!anime) return false;

  // Kalau episode udah ada, ga perlu scrape
  if (anime.episodes.length > 0) return true;

  // Kalau sourceUrl kosong, ga bisa scrape
  if (!anime.sourceUrl) return false;

  // Cooldown: kalau udah pernah scrape kurang dari 5 menit lalu, jangan retry
  if (anime.lastScrapedAt) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (anime.lastScrapedAt > fiveMinutesAgo) return false;
  }

  console.log(`[AutoScrape] Episode kosong untuk "${slug}", scraping...`);

  try {
    // 1) Scrape detail page (termasuk episode list)
    const html = await HttpClient.getHtml(anime.sourceUrl);
    const detail = adapter.parseAnimeDetail(html, anime.sourceUrl);

    // 2) Scrape episode list
    const episodes = adapter.parseEpisodeList(html, slug);

    if (episodes.length === 0) {
      console.log(`[AutoScrape] "${slug}" — tetap 0 episode dari scrape.`);
      return false;
    }

    // 3) Update anime detail — selalu perbarui dari Samehadaku
    // Clean title: hapus "Sub Indo" suffix
    const cleanTitle = (detail.title || anime.title)?.replace(/\s*Sub\s*Indo\s*$/i, "").trim() || anime.title;
    // Clean synopsis: ganti "samehadaku" → "OrenJiNime"
    const cleanSynopsis = (detail.synopsis || anime.synopsis || "").replace(/samehadaku/gi, "OrenJiNime");

    await prisma.anime.update({
      where: { slug },
      data: {
        title: cleanTitle,
        synopsis: cleanSynopsis || anime.synopsis,
        poster: detail.poster || anime.poster,
        rating: detail.rating ?? anime.rating,
      },
    });

    // 4) Simpan episode ke DB
    await prisma.episode.createMany({
      data: episodes.map((ep) => ({
        animeId: anime.id,
        episodeNumber: ep.episodeNumber,
        title: ep.title || null,
        sourceUrl: ep.sourceUrl || `https://v2.samehadaku.how/${slug}-episode-${ep.episodeNumber}/`,
      })),
      skipDuplicates: true,
    });

    console.log(`[AutoScrape] "${slug}" — ${episodes.length} episode tersimpan.`);
    return true;
  } catch (err) {
    console.error(`[AutoScrape] Gagal scrape "${slug}":`, err);
    // Tandai udah coba scrape supaya ga retry terus
    await prisma.anime.update({
      where: { slug },
      data: { lastScrapedAt: new Date() },
    });
    return false;
  }
}
