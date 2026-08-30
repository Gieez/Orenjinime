export const dynamic = "force-dynamic"; // Dynamic: auto-scrape butuh fresh render, ga cache

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import VideoPlayer from "@/components/VideoPlayer";
import Link from "next/link";
import { SaveWatchHistory } from "@/components/SaveWatchHistory";
import { AdBanner } from "@/components/AdBanner";
import { autoScrapeStreamsIfNeeded } from "@/lib/auto-scrape-streams";
import { autoScrapeAnimeIfNeeded } from "@/lib/auto-scrape";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ anime: string; episode: string }>;
}) {
  const { anime: slug, episode: epParam } = await params;
  const episodeNumber = parseInt(epParam, 10);

  if (isNaN(episodeNumber)) return notFound();

  let episode = await prisma.episode.findFirst({
    where: {
      episodeNumber: episodeNumber,
      anime: { slug: slug },
    },
    include: {
      anime: {
        include: {
          episodes: {
            orderBy: { episodeNumber: "asc" },
          },
        },
      },
      streamSources: true,
    },
  });

  // Kalau episode belum ada di DB → auto-scrape anime + episodes dulu
  if (!episode) {
    const animeExists = await prisma.anime.findUnique({ where: { slug } });
    if (animeExists) {
      await autoScrapeAnimeIfNeeded(slug);

      // Coba ambil episode lagi
      episode = await prisma.episode.findFirst({
        where: {
          episodeNumber: episodeNumber,
          anime: { slug: slug },
        },
        include: {
          anime: {
            include: {
              episodes: { orderBy: { episodeNumber: "asc" } },
            },
          },
          streamSources: true,
        },
      });
    }
  }

  if (!episode) return notFound();

  // Kalau stream kosong + belum pernah di-scrape → scrape SEKALI
  let streamsEmpty = !episode.streamSources || episode.streamSources.length === 0;
  if (streamsEmpty && !episode.lastScrapedAt) {
    await autoScrapeStreamsIfNeeded(episode.id);

    // Reload episode dari DB
    const refreshed = await prisma.episode.findFirst({
      where: { id: episode.id },
      include: {
        anime: {
          include: {
            episodes: { orderBy: { episodeNumber: "asc" } },
          },
        },
        streamSources: true,
      },
    });

    if (refreshed) {
      streamsEmpty = refreshed.streamSources.length === 0;
      // Use refreshed data for rendering
      Object.assign(episode, refreshed);
    }
  }

  // Navigation helpers
  const allEpisodes = episode.anime.episodes || [];
  const prevEpisode = allEpisodes.find((e) => e.episodeNumber === episodeNumber - 1);
  const nextEpisode = allEpisodes.find((e) => e.episodeNumber === episodeNumber + 1);

  return (
    <main className="mx-auto max-w-5xl px-4 pt-24 pb-12">
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-neutral-400">
        <Link href="/" className="hover:text-brand transition">Home</Link>
        <span>/</span>
        <Link href={`/anime/${episode.anime.slug}`} className="hover:text-brand transition">
          {episode.anime.title}
        </Link>
        <span>/</span>
        <span className="text-white">Episode {episode.episodeNumber}</span>
      </div>

      {/* Judul Anime */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          {episode.anime.title} <span className="text-brand">— Episode {episode.episodeNumber}</span>
        </h1>
      </div>

      {/* Video Player */}
      <div className="rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900 shadow-xl">
        <VideoPlayer
          servers={episode.streamSources || []}
          animeSlug={episode.anime.slug}
          episodeNumber={episode.episodeNumber}
          introStart={null}
          introEnd={null}
        />
      </div>

      {/* Auto-save to watch history */}
      <SaveWatchHistory
        slug={episode.anime.slug}
        title={episode.anime.title}
        poster={episode.anime.poster}
        episodeNumber={episode.episodeNumber}
      />

      {/* Stream sources empty warning */}
      {streamsEmpty && (
        <div className="mt-4 rounded-xl border border-yellow-800 bg-yellow-900/20 p-4 text-sm text-yellow-300">
          Sumber video (Server) tidak tersedia atau kosong.
        </div>
      )}

      {/* NAVIGASI TOMBOL PREV / NEXT */}
      <div className="mt-6 flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm font-semibold shadow-md">
        {prevEpisode ? (
          <Link
            href={`/watch/${slug}/${prevEpisode.episodeNumber}`}
            className="flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-neutral-300 transition hover:bg-neutral-700 hover:text-white"
          >
            ← Prev <span className="hidden sm:inline">Episode</span>
          </Link>
        ) : (
          <div className="cursor-not-allowed rounded-lg px-4 py-2 text-neutral-600">← Prev</div>
        )}

        <Link
          href={`/anime/${slug}`}
          className="text-neutral-400 hover:text-white transition"
        >
          Detail Anime
        </Link>

        {nextEpisode ? (
          <Link
            href={`/watch/${slug}/${nextEpisode.episodeNumber}`}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-white shadow-lg shadow-brand/20 transition hover:bg-brand-dark"
          >
            Next <span className="hidden sm:inline">Episode</span> →
          </Link>
        ) : (
          <div className="cursor-not-allowed rounded-lg px-4 py-2 text-neutral-600">Next →</div>
        )}
      </div>

      {/* GRID DAFTAR SEMUA EPISODE */}
      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-neutral-400">Pilih Episode Lain</h3>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
          {allEpisodes.map((ep) => {
            const isActive = ep.episodeNumber === episodeNumber;
            return (
              <Link
                key={ep.id}
                href={`/watch/${slug}/${ep.episodeNumber}`}
                className={`flex items-center justify-center rounded-md p-2 text-sm font-bold transition-all ${
                  isActive
                    ? "bg-brand text-white shadow-md ring-2 ring-brand/50"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white"
                }`}
              >
                {ep.episodeNumber}
              </Link>
            );
          })}
        </div>
      </div>

      {/* SINOPSIS */}
      <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h3 className="text-lg font-bold text-white mb-3">Sinopsis</h3>
        <p className="text-neutral-400 text-sm leading-relaxed text-justify">
          {episode.anime.synopsis || "Sinopsis belum tersedia."}
        </p>
      </div>

      {/* Ad Banner — bottom */}
      <AdBanner position="bottom" />
    </main>
  );
}
