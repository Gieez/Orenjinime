import { prisma } from "../../lib/prisma";
import { AnimeDetail, EpisodeItem, StreamItem, ScheduleItem, NewsItem } from "../adapters/types";
import { slugify } from "../../lib/slug";

export async function upsertAnime(data: AnimeDetail & { topOrder?: number | null }) {
  // upsert handles both create and update — no need for separate findUnique
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
      // Update latestOrder jika terdefinisi
      ...(data.latestOrder !== undefined ? { latestOrder: data.latestOrder } : {}),
      // ✅ Tambahkan handling topOrder agar bisa ter-update ke DB
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
      // ✅ Masukkan topOrder ke create
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
    },
    create: {
      animeId,
      episodeNumber: item.episodeNumber,
      title: item.title ?? null,
      sourceUrl: item.sourceUrl,
      releasedAt: item.releasedAt ?? null,
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

export async function saveStreams(episodeId: string, streams: StreamItem[]) {
  const db = prisma as unknown as Record<string, any>;
  const targetModel = db.episodeStream ? db.episodeStream : db.stream;

  if (targetModel) {
    await targetModel.deleteMany({ where: { episodeId } });
    if (streams.length > 0) {
      await targetModel.createMany({
        data: streams.map((s: StreamItem) => ({
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