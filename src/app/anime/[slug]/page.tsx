import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { HttpClient } from "@/scraper/http-client";
import { NugiAnimeAdapter } from "@/scraper/adapters/nuginime-adapter";

interface PageProps {
  params: Promise<{ slug: string }> | { slug: string };
}

async function getOrScrapeAnime(slug: string) {
  // 1. Cari di DB Lokal beserta relasi episodenya
  const existingAnime = await prisma.anime.findUnique({
    where: { slug },
    include: {
      episodes: { orderBy: { episodeNumber: "asc" } },
      genres: { include: { genre: true } },
    },
  });

  // Jika anime sudah ada DAN episodenya TIDAK KOSONG, kembalikan langsung
  if (existingAnime && existingAnime.episodes.length > 0) {
    return existingAnime;
  }

  // 2. On-Demand Scraping jika data belum ada ATAU episode-nya kosong
  try {
    const adapter = new NugiAnimeAdapter();
    const sourceUrl = `${adapter.baseUrl}/anime/${slug}/`;
    const html = await HttpClient.getHtml(sourceUrl);

    if (!html) return existingAnime;

    const detailData = adapter.parseAnimeDetail(html, sourceUrl);
    const episodeList = adapter.parseEpisodeList(html);

    // Siapkan relasi genre
    const genreConnections = await Promise.all(
      (detailData.genres || []).map(async (genreName) => {
        const genreSlug = genreName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        const g = await prisma.genre.upsert({
          where: { name: genreName },
          update: {},
          create: { name: genreName, slug: genreSlug },
        });
        return g.id;
      })
    );

    // 3. Gunakan URL 'slug' secara konsisten untuk where dan create guna mencegah konflik
    const savedAnime = await prisma.anime.upsert({
      where: { slug }, // 👈 Selalu gunakan slug dari parameter URL
      update: {
        title: detailData.title,
        poster: detailData.poster,
        synopsis: detailData.synopsis,
        type: detailData.type ?? undefined,
        status: detailData.status ?? undefined,
        rating: detailData.rating,
        studio: detailData.studio,
        sourceUrl: detailData.sourceUrl,
        episodes: {
          deleteMany: {},
          create: episodeList.map((ep) => ({
            episodeNumber: ep.episodeNumber,
            title: ep.title,
            sourceUrl: ep.sourceUrl,
          })),
        },
        genres: {
          deleteMany: {},
          create: genreConnections.map((genreId) => ({
            genre: {
              connect: { id: genreId },
            },
          })),
        },
      },
      create: {
        title: detailData.title,
        slug: slug, // 👈 Gunakan slug dari parameter URL
        poster: detailData.poster,
        synopsis: detailData.synopsis,
        type: detailData.type ?? undefined,
        status: detailData.status ?? undefined,
        rating: detailData.rating,
        studio: detailData.studio,
        sourceUrl: detailData.sourceUrl,
        episodes: {
          create: episodeList.map((ep) => ({
            episodeNumber: ep.episodeNumber,
            title: ep.title,
            sourceUrl: ep.sourceUrl,
          })),
        },
        genres: {
          create: genreConnections.map((genreId) => ({
            genre: {
              connect: { id: genreId },
            },
          })),
        },
      },
      include: {
        episodes: { orderBy: { episodeNumber: "asc" } },
        genres: { include: { genre: true } },
      },
    });

    return savedAnime;
  } catch (error) {
    console.error(`[ON-DEMAND FAILED] Gagal scrape ${slug}:`, error);
    return existingAnime;
  }
}

export default async function AnimeDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;

  if (!slug) notFound();

  const anime = await getOrScrapeAnime(slug);

  if (!anime) notFound();

  const firstEpisode = anime.episodes[0]?.episodeNumber;

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100 pb-16">
      {/* Hero Banner Section */}
      <section className="relative -mx-4 mb-8 overflow-hidden sm:mx-0 sm:rounded-3xl border border-zinc-800/50 bg-[#121215]">
        <div className="absolute inset-0">
          {anime.poster && (
            <img
              src={anime.poster}
              alt=""
              aria-hidden
              className="h-full w-full scale-110 object-cover opacity-20 blur-xl"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent" />
        </div>

        <div className="relative grid gap-6 p-6 sm:grid-cols-[220px_1fr] sm:p-10 z-10">
          {/* Poster */}
          <div className="mx-auto w-48 shrink-0 overflow-hidden rounded-2xl border border-zinc-700/50 shadow-2xl shadow-black/80 sm:mx-0 sm:w-full">
            <div className="aspect-[2/3] w-full bg-zinc-900">
              {anime.poster ? (
                <img src={anime.poster} alt={anime.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-zinc-500">
                  No Image
                </div>
              )}
            </div>
          </div>

          {/* Info Utama */}
          <div className="flex flex-col justify-end">
            <h1 className="text-2xl font-black leading-tight text-white md:text-4xl tracking-tight">
              {anime.title}
            </h1>

            {/* Metadata Badges */}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
              {anime.type && (
                <span className="rounded-lg bg-zinc-800/90 px-3 py-1 text-zinc-300 border border-zinc-700/40">
                  {anime.type}
                </span>
              )}
              {anime.status && (
                <span className="rounded-lg bg-orange-500/15 border border-orange-500/30 px-3 py-1 text-orange-400">
                  {anime.status}
                </span>
              )}
              {anime.studio && (
                <span className="rounded-lg bg-zinc-800/90 px-3 py-1 text-zinc-300 border border-zinc-700/40">
                  {anime.studio}
                </span>
              )}
              {anime.rating != null && anime.rating > 0 && (
                <span className="rounded-lg bg-zinc-800/90 px-3 py-1 text-amber-400 border border-zinc-700/40 flex items-center gap-1">
                  ★ {anime.rating.toFixed(1)}
                </span>
              )}
            </div>

            {/* Genre List */}
            {anime.genres && anime.genres.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {anime.genres.map((g) => (
                  <span
                    key={g.genreId}
                    className="rounded-full border border-zinc-700/60 bg-zinc-900/60 px-3 py-1 text-[11px] font-medium text-zinc-300 backdrop-blur-sm"
                  >
                    {g.genre.name}
                  </span>
                ))}
              </div>
            )}

            {/* Action Button */}
            <div className="mt-6 flex flex-wrap gap-3">
              {firstEpisode ? (
                <Link
                  href={`/watch/${anime.slug}/${firstEpisode}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/25 transition-all hover:bg-orange-500 hover:scale-105 active:scale-95"
                >
                  ▶ Tonton Episode {firstEpisode}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Sinopsis */}
      <section className="mb-10 rounded-2xl border border-zinc-800/60 bg-[#121215] p-6">
        <h2 className="mb-3 text-lg font-bold text-white flex items-center gap-2 border-l-4 border-orange-500 pl-3">
          Sinopsis
        </h2>
        <p className="text-sm leading-relaxed text-zinc-300">
          {anime.synopsis || "Belum ada sinopsis untuk anime ini."}
        </p>
      </section>

      {/* Daftar Episode */}
      <section className="rounded-2xl border border-zinc-800/60 bg-[#121215] p-6">
        <h2 className="mb-5 text-lg font-bold text-white flex items-center justify-between border-l-4 border-orange-500 pl-3">
          <span>Daftar Episode</span>
          {anime.episodes.length > 0 && (
            <span className="text-xs font-normal text-zinc-400">
              Total {anime.episodes.length} Episode
            </span>
          )}
        </h2>

        {anime.episodes.length === 0 ? (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-8 text-center text-sm text-zinc-400">
            Belum ada episode yang terdeteksi.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {anime.episodes.map((ep) => (
              <Link
                key={ep.id}
                href={`/watch/${anime.slug}/${ep.episodeNumber}`}
                className="group relative flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 transition-all duration-200 hover:border-orange-500 hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-600/20 active:scale-95"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 group-hover:text-white/80">
                  Episode
                </div>
                <div className="text-lg font-black text-zinc-100 group-hover:text-white">
                  {ep.episodeNumber}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}