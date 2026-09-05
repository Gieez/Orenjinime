import { prisma } from "../../lib/prisma";
import { AnimeDetail, EpisodeItem, StreamItem, ScheduleItem, NewsItem } from "../adapters/types";
import { slugify } from "../../lib/slug";

/**
 * Sync strategy (per session):
 *  - STEP A: FASE 1-3 — homepage first
 *      1. Scrape samehadaku.how/ — Top 10 + katalog (2 pages)
 *      2. Upsert all catalog items
 *      3. For each, scrape detail page (synopsis, genre, rating, status)
 *      4. Upsert all episodes (skip if exists, only update if missing fields)
 *      5. For each new episode, scrape stream sources (skip if already has)
 *
 *  - STEP B: BACKFILL
 *      - Find anime with episodes but no streamSources
 *      - Scrape stream sources for those episodes
 *      - Resolve proxy URLs to direct streaming host URLs
 *
 *  - STEP C: SCHEDULE
 *      - Scrape /jadwal/ once (all 7 days in single response)
 *      - Only keep entries for ONGOING/active anime
 *
 * Cloudflare note: got-scraping has Chrome TLS fingerprint but on
 * serverless/headless IPs (Vercel, GH Actions runners) it gets
 * challenged. The scraper should be run from a residential-IP env
 * (local dev, VPS, GH Action runner with proxy) — and the resolved
 * direct URLs are stored in DB so the production Vercel site never
 * has to hit samehadaku's protected AJAX endpoint.
 */

export async function upsertAnime(data: AnimeDetail & { topOrder?: number | null }) {
  const anime = await prisma.anime.upsert({
    where: { slug: data.slug },
    update: {
      title: data.title,
      alternativeTitle: data.alternativeTitle ?? null,
      synopsis: data.synopsis ?? null,
      poster: data.poster ?? null,
      banner: data.banner ?? null,
      status: data.status,
      type: data.type ?? undefined,
      year: data.year ?? null,
      studio: data.studio ?? null,
      rating: data.rating ?? null,
      popularity: data.popularity ?? 0,
      sourceUrl: data.sourceUrl,
      ...(data.latestOrder !== undefined ? { latestOrder: data.latestOrder } : {}),
      ...(data.topOrder !== undefined ? { topOrder: data.topOrder } : {}),
    },
    create: {
      title: data.title,
      slug: data.slug,
      alternativeTitle: data.alternativeTitle ?? null,
      synopsis: data.synopsis ?? null,
      poster: data.poster ?? null,
      banner: data.banner ?? null,
      status: data.status,
      type: data.type ?? undefined,
      year: data.year ?? null,
      studio: data.studio ?? null,
      rating: data.rating ?? null,
      popularity: data.popularity ?? 0,
      sourceUrl: data.sourceUrl,
      latestOrder: data.latestOrder ?? null,
      topOrder: data.topOrder ?? null,
    },
  });

  if (data.genres && data.genres.length > 0) {
    for (const genreName of data.genres) {
      const genreSlug = slugify(genreName);
      const genre = await prisma.genre.upsert({
        where: { slug: genreSlug },
        update: { name: genreName },
        create: { name: genreName, slug: genreSlug },
      });

      await prisma.genreOnAnime.upsert({
        where: {
          animeId_genreId: {
            animeId: anime.id,
            genreId: genre.id,
          },
        },
        update: {},
        create: {
          animeId: anime.id,
          genreId: genre.id,
        },
      });
    }
  }

  if (data.producers && data.producers.length > 0) {
    for (const producerName of data.producers) {
      const producerSlug = slugify(producerName);
      const producer = await prisma.producer.upsert({
        where: { slug: producerSlug },
        update: { name: producerName },
        create: { name: producerName, slug: producerSlug },
      });

      await prisma.producerOnAnime.upsert({
        where: {
          animeId_producerId: {
            animeId: anime.id,
            producerId: producer.id,
          },
        },
        update: {},
        create: {
          animeId: anime.id,
          producerId: producer.id,
        },
      });
    }
  }

  return {
    id: anime.id,
    result: "upserted" as "upserted",
    anime,
  };
}

export async function upsertEpisode(animeId: string, item: EpisodeItem) {
  return prisma.episode.upsert({
    where: {
      animeId_episodeNumber: {
        animeId,
        episodeNumber: item.episodeNumber,
      },
    },
    update: {
      title: item.title ?? null,
      sourceUrl: item.sourceUrl,
      releasedAt: item.releasedAt ?? null,
      lastScrapedAt: new Date(),
    },
    create: {
      animeId,
      episodeNumber: item.episodeNumber,
      title: item.title ?? null,
      sourceUrl: item.sourceUrl,
      releasedAt: item.releasedAt ?? null,
      lastScrapedAt: new Date(),
    },
  });
}

export async function upsertEpisodes(animeId: string, items: EpisodeItem[]) {
  const results = [];
  for (const item of items) {
    results.push(await upsertEpisode(animeId, item));
  }
  return results;
}

/**
 * Save streams for an episode. Resolves proxy URLs to direct iframe URLs
 * so the production Vercel site never has to hit samehadaku's protected
 * AJAX endpoint at runtime (which gets Cloudflare-blocked on serverless IPs).
 *
 * If resolution fails for a particular proxy, falls back to keeping the
 * proxy URL — embed route still works in local dev.
 */
export async function saveStreams(
  episodeId: string,
  streams: StreamItem[],
  resolver?: (proxyUrls: string[]) => Promise<Map<string, string>>,
) {
  const db = prisma as unknown as Record<string, any>;
  const targetModel = db.episodeStream ? db.episodeStream : db.stream;

  if (targetModel) {
    await targetModel.deleteMany({ where: { episodeId } });
    if (streams.length > 0) {
      let finalUrls = streams;
      if (resolver) {
        const proxyUrls = streams
          .map((s) => s.url)
          .filter((u) => u.startsWith("/api/player/embed"));
        if (proxyUrls.length > 0) {
          try {
            const resolved = await resolver(proxyUrls);
            finalUrls = streams.map((s) => ({
              ...s,
              url: resolved.get(s.url) || s.url,
            }));
          } catch (err) {
            console.error(`[saveStreams] Resolve failed for ep ${episodeId}:`, err);
          }
        }
      }
      await targetModel.createMany({
        data: finalUrls.map((s: StreamItem) => ({
          episodeId,
          name: s.name,
          url: s.url,
          quality: s.quality ?? null,
          type: s.type ?? null,
        })),
      });
    }
  }
}

const DAY_INT_MAP: Record<string, number> = {
  minggu: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, jumaat: 5, sabtu: 6,
};

export async function upsertSchedule(item: ScheduleItem) {
  if (!item.dayOfWeek) return null;
  const dayInt = typeof item.dayOfWeek === "number" ? item.dayOfWeek : DAY_INT_MAP[item.dayOfWeek.toLowerCase()] ?? 1;

  const anime = item.animeSlug
    ? await prisma.anime.findUnique({ where: { slug: item.animeSlug } })
    : null;

  if (!anime) return null;

  const db = prisma as unknown as Record<string, any>;
  if (db.schedule) {
    return db.schedule.upsert({
      where: {
        animeId_dayOfWeek: {
          animeId: anime.id,
          dayOfWeek: dayInt,
        },
      },
      update: { airTime: item.airTime },
      create: {
        animeId: anime.id,
        dayOfWeek: dayInt,
        airTime: item.airTime,
      },
    });
  }
  return null;
}

export async function upsertNews(item: NewsItem) {
  const db = prisma as unknown as Record<string, any>;
  if (db.news) {
    return db.news.upsert({
      where: { slug: item.slug },
      update: {
        title: item.title,
        synopsis: item.synopsis ?? null,
        content: item.content || "",
        thumbnail: item.thumbnail ?? null,
        sourceUrl: item.sourceUrl,
        publishedAt: item.publishedAt ?? null,
      },
      create: {
        title: item.title,
        slug: item.slug,
        synopsis: item.synopsis ?? null,
        content: item.content || "",
        thumbnail: item.thumbnail ?? null,
        sourceUrl: item.sourceUrl,
        publishedAt: item.publishedAt ?? null,
      },
    });
  }
  return null;
}

export async function recordFailedUrl(url: string, error: string, type?: string) {
  const db = prisma as unknown as Record<string, any>;
  if (db.failedUrl) {
    try {
      return await db.failedUrl.upsert({
        where: { url },
        update: {
          error,
          failedAt: new Date(),
        },
        create: {
          url,
          error,
          type: type || "UNKNOWN",
        },
      });
    } catch {
      return null;
    }
  }
  return null;
}
