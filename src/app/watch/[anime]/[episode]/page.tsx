import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import VideoPlayer from "@/components/VideoPlayer";
import Link from "next/link";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ anime: string; episode: string }>;
}) {
  const { anime: slug, episode: epParam } = await params;
  const episodeNumber = parseInt(epParam, 10);

  if (isNaN(episodeNumber)) return notFound();

  // DB-only — no live scraping. Data is pre-populated by cron job.
  const episode = await prisma.episode.findFirst({
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

  if (!episode) return notFound();

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

      {/* Stream sources empty warning */}
      {(!episode.streamSources || episode.streamSources.length === 0) && (
        <div className="mt-4 rounded-xl border border-yellow-800 bg-yellow-900/20 p-4 text-sm text-yellow-300">
          Sumber streaming belum tersedia untuk episode ini. Data akan diperbarui oleh sistem sinkronisasi otomatis.
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
    </main>
  );
}
