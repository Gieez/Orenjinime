import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatRating } from "@/lib/format";
import { ContinueWatching } from "@/components/ContinueWatching";

// Set revalidate misal tiap 1 jam, atau biarkan dinamis tanpa sync berat di awal
export const revalidate = 3600; 

export default async function HomePage() {
  // 🚀 AMBIL DATA LANGSUNG DARI DATABASE LOKAL (SUPER CEPAT < 0.1 DETIK)
  
  // 2. LATEST EPISODE
  const finalLatestAnime = await prisma.anime.findMany({
    where: { latestOrder: { not: null } },
    take: 12,
    orderBy: { latestOrder: "asc" },
    include: {
      episodes: { take: 1, orderBy: { episodeNumber: "desc" } },
    },
  });

  // 3. TOP 10 ANIME
  const topAnime = await prisma.anime.findMany({
    where: { topOrder: { not: null, lte: 10 } },
    take: 10,
    orderBy: { topOrder: "asc" },
    include: { episodes: { take: 1, orderBy: { episodeNumber: "desc" } } },
  });

  // 4. ANIME COMPLETED
  const completedAnime = await prisma.anime.findMany({
    where: { status: "COMPLETED" },
    take: 12,
    orderBy: { updatedAt: "desc" },
    include: { episodes: { take: 1, orderBy: { episodeNumber: "desc" } } },
  });

  const featured = finalLatestAnime[0] || topAnime[0] || completedAnime[0];

  return (
    <main className="space-y-10 pb-12">
      {topAnime.length === 0 && finalLatestAnime.length === 0 && completedAnime.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-10 text-center text-sm text-neutral-400">
          Belum ada data anime di database. Silakan jalankan scraper terlebih dahulu melalui panel admin / API sync.
        </div>
      ) : (
        <>
          {/* HERO BANNER */}
          {featured && (
            <section className="relative -mt-2 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900">
              <div className="absolute inset-0">
                {featured.poster && (
                  <img
                    src={featured.poster}
                    alt=""
                    aria-hidden
                    className="h-full w-full scale-110 object-cover opacity-25 blur-md"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-neutral-950/20" />
                <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/90 via-neutral-950/40 to-transparent" />
              </div>

              <div className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:p-10">
                <div className="hidden w-40 shrink-0 overflow-hidden rounded-xl border border-neutral-800 shadow-2xl sm:block">
                  <div className="aspect-[2/3] w-full bg-neutral-800">
                    {featured.poster && (
                      <img src={featured.poster} alt={featured.title} className="h-full w-full object-cover" />
                    )}
                  </div>
                </div>

                <div className="max-w-2xl">
                  <span className="mb-3 inline-block rounded-full bg-brand/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand">
                    Rekomendasi Utama
                  </span>
                  <h1 className="text-2xl font-extrabold text-white sm:text-4xl">
                    {featured.title}
                  </h1>
                  <div className="mt-3 flex items-center gap-2 text-xs text-neutral-300">
                    {featured.rating != null && featured.rating > 0 && (
                      <span className="rounded bg-neutral-800 px-2 py-1 text-yellow-400 font-bold">
                        ★ {formatRating(featured.rating)}
                      </span>
                    )}
                    <span className="rounded bg-neutral-800 px-2 py-1 text-neutral-300 uppercase">
                      {featured.status}
                    </span>
                  </div>
                  <div className="mt-6 flex gap-3">
                    {featured.episodes?.[0] ? (
                      <Link
                        href={`/watch/${featured.slug}/${featured.episodes[0].episodeNumber}`}
                        className="rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"
                      >
                        ▶ Tonton Ep {featured.episodes[0].episodeNumber}
                      </Link>
                    ) : (
                      <Link
                        href={`/anime/${featured.slug}`}
                        className="rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark"
                      >
                        Detail Anime
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* CONTINUE WATCHING (localStorage-based) */}
          <ContinueWatching />

          {/* TOP 10 ANIME (Horizontal Swipe) */}
          {topAnime.length > 0 && (
            <section className="relative">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-neutral-100">Top 10 Minggu Ini</h2>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 pt-1 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                {topAnime.map((anime, index) => {
                  const rank = anime.topOrder ?? index + 1;
                  return (
                    <div key={anime.slug} className="group relative w-[140px] shrink-0 sm:w-[160px] md:w-[180px]">
                      <Link href={`/anime/${anime.slug}`} className="block">
                        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-md transition group-hover:border-brand">
                          {anime.poster ? (
                            <img src={anime.poster} alt={anime.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">No Image</div>
                          )}
                          <div className="absolute left-2 top-2 z-10 flex flex-col items-center rounded bg-neutral-950/80 px-2 py-1 text-center backdrop-blur-md border border-neutral-800 shadow">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 leading-none">TOP</span>
                            <span className="text-sm font-black text-brand leading-none mt-0.5">{rank}</span>
                          </div>
                          {anime.rating != null && anime.rating > 0 && (
                            <div className="absolute bottom-2 right-2 z-10 rounded bg-neutral-950/80 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400 backdrop-blur-md border border-neutral-800">
                              ★ {formatRating(anime.rating)}
                            </div>
                          )}
                        </div>
                        <h3 className="mt-2 text-xs font-semibold text-neutral-200 line-clamp-2 group-hover:text-brand sm:text-sm">
                          {anime.title}
                        </h3>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* LATEST EPISODE (Versi Lebih Bagus: Menampilkan info Episode terbaru & Status) */}
          {finalLatestAnime.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-neutral-100">Latest Episode</h2>
                <Link href="/anime?status=ONGOING" className="text-xs font-semibold text-brand hover:underline">
                  Lihat Semua →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {finalLatestAnime.map((anime) => {
                  const latestEp = anime.episodes?.[0];
                  return (
                    <div key={anime.slug} className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 transition hover:border-brand">
                      <Link href={`/anime/${anime.slug}`} className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-950">
                        {anime.poster ? (
                          <img src={anime.poster} alt={anime.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">No Image</div>
                        )}
                        {/* Badge Status Ongoing/Completed */}
                        <span className="absolute left-2 top-2 rounded bg-brand/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                          {anime.status}
                        </span>
                        {/* Rating */}
                        {anime.rating != null && anime.rating > 0 && (
                          <span className="absolute bottom-2 right-2 rounded bg-neutral-950/80 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400 backdrop-blur-md border border-neutral-800">
                            ★ {formatRating(anime.rating)}
                          </span>
                        )}
                      </Link>

                      <div className="flex flex-1 flex-col justify-between p-3">
                        <Link href={`/anime/${anime.slug}`}>
                          <h3 className="text-xs font-semibold text-neutral-200 line-clamp-2 group-hover:text-brand sm:text-sm">
                            {anime.title}
                          </h3>
                        </Link>

                        <div className="mt-3 pt-2 border-t border-neutral-800 flex items-center justify-between">
                          <span className="text-[11px] text-neutral-400 font-medium">
                            {latestEp ? `Ep. ${latestEp.episodeNumber}` : "Segera"}
                          </span>
                          {latestEp ? (
                            <Link
                              href={`/watch/${anime.slug}/${latestEp.episodeNumber}`}
                              className="rounded bg-brand/20 px-2 py-1 text-[11px] font-bold text-brand hover:bg-brand hover:text-white transition"
                            >
                              Tonton
                            </Link>
                          ) : (
                            <span className="text-[10px] text-neutral-500">N/A</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* ANIME COMPLETED (Versi Detail dengan Info Completed) */}
          {completedAnime.length > 0 && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-neutral-100">Anime Completed</h2>
                <Link href="/anime?status=COMPLETED" className="text-xs font-semibold text-brand hover:underline">
                  Lihat Semua →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {completedAnime.map((anime) => {
                  const latestEp = anime.episodes?.[0];
                  return (
                    <div key={anime.slug} className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 transition hover:border-brand">
                      <Link href={`/anime/${anime.slug}`} className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-950">
                        {anime.poster ? (
                          <img src={anime.poster} alt={anime.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">No Image</div>
                        )}
                        <span className="absolute left-2 top-2 rounded bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                          COMPLETED
                        </span>
                        {anime.rating != null && anime.rating > 0 && (
                          <span className="absolute bottom-2 right-2 rounded bg-neutral-950/80 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400 backdrop-blur-md border border-neutral-800">
                            ★ {formatRating(anime.rating)}
                          </span>
                        )}
                      </Link>

                      <div className="flex flex-1 flex-col justify-between p-3">
                        <Link href={`/anime/${anime.slug}`}>
                          <h3 className="text-xs font-semibold text-neutral-200 line-clamp-2 group-hover:text-brand sm:text-sm">
                            {anime.title}
                          </h3>
                        </Link>

                        <div className="mt-3 pt-2 border-t border-neutral-800 flex items-center justify-between">
                          <span className="text-[11px] text-emerald-400 font-medium">
                            {latestEp ? `Total ${latestEp.episodeNumber} Eps` : "Tamat"}
                          </span>
                          <Link
                            href={`/anime/${anime.slug}`}
                            className="rounded bg-neutral-800 px-2 py-1 text-[11px] font-bold text-neutral-300 hover:bg-brand hover:text-white transition"
                          >
                            Detail
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
