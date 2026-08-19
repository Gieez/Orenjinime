import { prisma } from "@/lib/prisma";
import { NugiAnimeAdapter } from "@/scraper/adapters/nuginime-adapter";
import { HttpClient } from "@/scraper/http-client";
import { upsertAnime, upsertEpisodes } from "@/scraper/persist/upsert";
import { getFullEpisodeWithFallback } from "./stream-service";

const adapter = new NugiAnimeAdapter();

/**
 * Sync data homepage (Anime Terbaru) dan Top 10 anime.
 */
export async function autoSyncHomepage() {
  try {
    const targetUrl = adapter.baseUrl;
    const html = await HttpClient.getHtml(targetUrl);
    if (!html) return;

    // 1. Scrape data dari HTML
    const { items: animeList } = await adapter.scrapeCatalog(html);
    const top10List = adapter.parseTop10(html);

    // 2. Sync Latest Episode (Gunakan Promise.all / sequential)
    if (animeList && animeList.length > 0) {
      // Reset latestOrder khusus sebelum memasukkan yang baru
      await prisma.anime.updateMany({ data: { latestOrder: null } });

      let latestRank = 1;
      for (const item of animeList) {
        if (item.slug && item.title) {
          await upsertAnime({
            title: item.title,
            slug: item.slug,
            poster: item.poster || null,
            sourceUrl: item.sourceUrl || `${adapter.baseUrl}/anime/${item.slug}/`,
            status: "ONGOING",
            latestOrder: latestRank++,
          } as any);
        }
      }
    }

    // 3. Sync Top 10 Anime
    if (top10List && top10List.length > 0) {
      // Reset topOrder hanya saat data Top 10 berhasil didapatkan
      await prisma.anime.updateMany({ data: { topOrder: null } });

      for (const item of top10List) {
        if (item.slug && item.title) {
          await upsertAnime({
            title: item.title,
            slug: item.slug,
            poster: item.poster,
            rating: item.rating,
            sourceUrl: item.url,
            status: "ONGOING",
            topOrder: item.rank, // ✅ Dipastikan masuk ke database
          } as any);
        }
      }
    }
  } catch (error) {
    console.error("[AutoSyncHomepage Error]:", error);
  }
}

/**
 * Mengambil detail anime dari DB; jika tidak ditemukan, lakukan fallback scraping & upsert.
 */
export async function getAnimeWithFallback(slug: string) {
  const cleanSlug = slug.replace(/^\/+|\/+$/g, "");

  // 1. Cek dulu di Database local
  let anime = await prisma.anime.findUnique({
    where: { slug: cleanSlug },
    include: {
      genres: { include: { genre: true } },
      producers: { include: { producer: true } },
      episodes: {
        orderBy: { episodeNumber: "desc" },
      },
    },
  });

  // 2. Jika data anime sudah ada di Database DAN episodenya lengkap, LANGSUNG KEMBALIKAN (Super Cepat)
  if (anime && anime.episodes.length > 0) {
    return anime;
  }

  // 3. Jika BELUM ADA di Database (atau episodenya 0), jalankan Real-time Scraping Fallback
  const targetUrl = `${adapter.baseUrl}/anime/${cleanSlug}/`;
  try {
    console.log(`[Auto-Scrape] Mendeteksi anime baru/kosong: ${cleanSlug}. Mulai scraping...`);
    const html = await HttpClient.getHtml(targetUrl);

    if (html) {
      const detail = adapter.parseAnimeDetail(html, targetUrl);
      const rawEpisodes = adapter.parseEpisodeList(html, cleanSlug);

      if (detail && detail.title) {
        // Simpan Data Anime
        const savedAnime = await upsertAnime({
          ...detail,
          slug: cleanSlug,
          sourceUrl: targetUrl,
        });

        // Simpan Daftar Episode
        if (rawEpisodes && rawEpisodes.length > 0) {
          await upsertEpisodes(savedAnime.id, rawEpisodes);
        }
        
        console.log(`[Auto-Scrape] Sukses menyimpan: ${cleanSlug}`);
      }
    }
  } catch (error) {
    console.error(`[Anime Realtime Sync Error] Slug "${cleanSlug}":`, error);
  }

  // 4. Query ulang dari Database setelah disave agar data & relasinya up-to-date
  return prisma.anime.findUnique({
    where: { slug: cleanSlug },
    include: {
      genres: { include: { genre: true } },
      producers: { include: { producer: true } },
      episodes: {
        orderBy: { episodeNumber: "desc" },
      },
    },
  });
}

/**
 * Mengambil data episode dari DB; jika episode/stream belum ada, lakukan fallback scraping.
 */
export async function getEpisodeWithFallback(slug: string, episodeNumber: number) {
  const cleanSlug = slug.replace(/^\/+|\/+$/g, "");

  const includeQuery = {
    anime: {
      include: {
        episodes: {
          orderBy: { episodeNumber: "asc" as const },
        },
        genres: { include: { genre: true } },
        producers: { include: { producer: true } },
      },
    },
    streamSources: true,
    subtitles: true,
  };

  let currentEpisode = await prisma.episode.findFirst({
    where: {
      anime: { slug: cleanSlug },
      episodeNumber,
    },
    include: includeQuery,
  });

  // Jika episode tidak ada di database, coba scraping detail animenya terlebih dahulu
  if (!currentEpisode) {
    const anime = await getAnimeWithFallback(cleanSlug);
    if (!anime) {
      return { anime: null, currentEpisode: null };
    }

    currentEpisode = await prisma.episode.findFirst({
      where: {
        anime: { slug: cleanSlug },
        episodeNumber,
      },
      include: includeQuery,
    });
  }

  if (!currentEpisode) {
    return { anime: null, currentEpisode: null };
  }

  // Jika stream sources masih kosong, ambil video stream real-time dari episode sourceUrl
  const sourceUrl = currentEpisode.sourceUrl;
  if (currentEpisode.streamSources.length === 0 && sourceUrl) {
    await getFullEpisodeWithFallback(currentEpisode.id, sourceUrl);

    currentEpisode = await prisma.episode.findUnique({
      where: { id: currentEpisode.id },
      include: includeQuery,
    });
  }

  return {
    anime: currentEpisode?.anime || null,
    currentEpisode: currentEpisode || null,
  };
}