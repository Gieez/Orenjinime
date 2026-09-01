export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EpisodeList } from "@/components/EpisodeList";
import { NugiAnimeAdapter } from "@/scraper/adapters/nuginime-adapter";
import { upsertAnime, upsertEpisodes } from "@/scraper/persist/upsert";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const adapter = new NugiAnimeAdapter();

interface PageProps {
  params: Promise<{ slug: string }> | { slug: string };
}

async function getAnimeFromDb(slug: string) {
  try {
    const anime = await prisma.anime.findUnique({
      where: { slug },
      include: {
        episodes: { orderBy: { episodeNumber: "asc" } },
        genres: { include: { genre: true } },
      },
    });
    return anime;
  } catch (error) {
    console.error(`[DATABASE ERROR] Gagal mengambil anime ${slug}:`, error);
    return null;
  }
}

/**
 * Scrape anime detail dari Samehadaku via curl, simpan ke DB.
 * Dipanggil saat anime belum ada di DB (live search result dari user).
 */
async function scrapeAndSaveAnime(slug: string, sourceUrl: string) {
  console.log(`[SCRAPE-ON-DEMAND] Scraping ${slug} dari ${sourceUrl}`);

  try {
    const { stdout } = await execAsync(
      `curl -s -L --max-time 20 ` +
        `-H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" ` +
        `-H "Accept-Language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7" ` +
        `-H "Referer: https://v2.samehadaku.how/" ` +
        `"${sourceUrl}"`,
      { maxBuffer: 10 * 1024 * 1024 }
    );

    if (!stdout || stdout.length < 500) {
      console.log(`[SCRAPE-ON-DEMAND] Response kosong/pendek untuk ${slug}`);
      return null;
    }

    // Parse detail + episodes
    const detailData = adapter.parseAnimeDetail(stdout, sourceUrl);
    const episodeList = adapter.parseEpisodeList(stdout);

    // Save ke DB
    const saved = await upsertAnime({
      ...detailData,
      slug,
    });

    if (episodeList.length > 0) {
      await upsertEpisodes(saved.id, episodeList);
      console.log(`[SCRAPE-ON-DEMAND] OK ${slug}: ${episodeList.length} episodes saved.`);

      // Scrape streams untuk episode terbaru (max 5) supaya user langsung bisa nonton
      const latestEps = episodeList
        .filter((ep) => ep.sourceUrl)
        .sort((a, b) => b.episodeNumber - a.episodeNumber)
        .slice(0, 5);

      let streamsScraped = 0;
      for (const ep of latestEps) {
        const epRecord = await prisma.episode.findUnique({
          where: { animeId_episodeNumber: { animeId: saved.id, episodeNumber: ep.episodeNumber } },
        });
        if (!epRecord || !ep.sourceUrl) continue;

        try {
          const epHtml = await execAsync(
            `curl -s -L --max-time 15 ` +
              `-H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" ` +
              `-H "Referer: https://v2.samehadaku.how/" ` +
              `"${ep.sourceUrl}"`,
            { maxBuffer: 5 * 1024 * 1024 }
          );
          if (epHtml.stdout) {
            const streams = adapter.parseStreamSources(epHtml.stdout);
            if (streams.length > 0) {
              await prisma.streamSource.deleteMany({ where: { episodeId: epRecord.id } });
              await prisma.streamSource.createMany({
                data: streams.map((s) => ({
                  episodeId: epRecord.id,
                  name: s.name,
                  url: s.url,
                  quality: s.quality || "HD",
                  type: s.type || "embed",
                })),
              });
              streamsScraped += streams.length;
            }
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 1500));
      }
      console.log(`[SCRAPE-ON-DEMAND] Streams: ${streamsScraped} sources untuk ${Math.min(latestEps.length, 5)} episode terbaru.`);
    } else {
      console.log(`[SCRAPE-ON-DEMAND] OK ${slug}: detail saved, no episodes found.`);
    }

    return saved;
  } catch (err: any) {
    console.error(`[SCRAPE-ON-DEMAND] Gagal scrape ${slug}:`, err?.message);
    return null;
  }
}

export default async function AnimeDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams?.slug;

  if (!slug) notFound();

  // 1) Coba ambil dari DB
  let anime = await getAnimeFromDb(slug);

  // 2) Kalau belum ada di DB, coba baca sourceUrl dari cookie (set oleh search page)
  if (!anime) {
    const cookieStore = await cookies();
    const sourceUrl = cookieStore.get(`sourceUrl:${slug}`)?.value;

    if (sourceUrl) {
      // Cookie one-time use — just read, don't set (cookies() can't set in server component)
      await scrapeAndSaveAnime(slug, sourceUrl);
      anime = await getAnimeFromDb(slug);
    }
  }

  // 3) Masih ga ada → 404
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
          <div className="text-center py-8 text-zinc-500 text-sm">
            Episode belum tersedia. Episode akan di-update otomatis oleh sistem.
          </div>
        ) : (
          <EpisodeList
            episodes={anime.episodes}
            animeSlug={anime.slug}
            defaultVisible={24}
          />
        )}
      </section>
    </main>
  );
}
