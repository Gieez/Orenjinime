/**
 * Scrape anime detail + episodes dari Samehadaku, simpan ke DB.
 * Dipanggil kalau anime belum ada di DB tapi user buka langsung URL-nya.
 */
import { prisma } from "@/lib/prisma";
import { HttpClient } from "@/scraper/http-client";
import { NugiAnimeAdapter } from "@/scraper/adapters/nuginime-adapter";

const adapter = new NugiAnimeAdapter();

export async function scrapeAndSaveAnime(slug: string, sourceUrl: string): Promise<boolean> {
  // Cek apakah udah ada di DB
  const existing = await prisma.anime.findUnique({ where: { slug } });
  if (existing) return true;

  console.log(`[ScrapeAndSave] Scraping "${slug}" dari ${sourceUrl}`);

  try {
    // 1) Scrape detail page
    const html = await HttpClient.getHtml(sourceUrl);
    const detail = adapter.parseAnimeDetail(html, sourceUrl);

    // 2) Clean data: hapus "Sub Indo" dari judul, ganti "samehadaku" → "OrenJiNime" di sinopsis
    const cleanTitle = (detail.title || slug).replace(/\s*Sub\s*Indo\s*$/i, "").trim();
    const cleanSynopsis = (detail.synopsis || "").replace(/samehadaku/gi, "OrenJiNime");

    // 3) Simpan anime ke DB
    const anime = await prisma.anime.create({
      data: {
        title: cleanTitle,
        slug,
        alternativeTitle: detail.alternativeTitle || null,
        synopsis: cleanSynopsis || null,
        poster: detail.poster || null,
        status: detail.status || "ONGOING",
        type: detail.type || "TV",
        year: detail.year || null,
        studio: detail.studio || null,
        rating: detail.rating ?? null,
        sourceUrl,
        lastScrapedAt: new Date(),
      },
    });

    // 4) Simpan genres
    if (detail.genres && detail.genres.length > 0) {
      for (const genreName of detail.genres) {
        const genreSlug = genreName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const genre = await prisma.genre.upsert({
          where: { name: genreName },
          update: {},
          create: { name: genreName, slug: genreSlug },
        });
        await prisma.genreOnAnime.create({
          data: { animeId: anime.id, genreId: genre.id },
        });
      }
    }

    // 5) Scrape episode list
    const episodes = adapter.parseEpisodeList(html, slug);
    if (episodes.length > 0) {
      // Filter: sourceUrl harus ada dan unik
      const seen = new Set<string>();
      const validEpisodes = episodes.filter((ep) => {
        if (!ep.sourceUrl) return false;
        if (seen.has(ep.sourceUrl)) return false;
        seen.add(ep.sourceUrl);
        return true;
      });

      if (validEpisodes.length > 0) {
        await prisma.episode.createMany({
          data: validEpisodes.map((ep) => ({
            animeId: anime.id,
            episodeNumber: ep.episodeNumber,
            title: ep.title || null,
            sourceUrl: ep.sourceUrl,
          })),
          skipDuplicates: true,
        });
      }

      console.log(`[ScrapeAndSave] "${slug}" saved: ${validEpisodes.length} episodes (from ${episodes.length} parsed)`);
    } else {
      console.log(`[ScrapeAndSave] "${slug}" — 0 episodes parsed from HTML`);
    }
    return true;
  } catch (err) {
    console.error(`[ScrapeAndSave] Gagal scrape "${slug}":`, err);
    return false;
  }
}
