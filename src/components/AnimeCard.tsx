"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { formatRating, getCleanImageUrl, timeAgo } from "@/lib/format";

export interface AnimeCardData {
  slug: string;
  title: string;
  poster?: string | null;
  rating?: number | null;
  type?: string | null;
  status?: string | null;
  updatedAt?: Date | string | null;
  latestEpisodeRelease?: Date | string | null;
  episodes?: Array<{
    episodeNumber: number;
    createdAt?: Date | string | null;
  }>;
}

interface AnimeCardProps {
  anime: AnimeCardData;
  priority?: boolean;
}

export function AnimeCard({ anime, priority = false }: AnimeCardProps) {
  const [imgError, setImgError] = useState(false);
  const cleanPoster = getCleanImageUrl(anime.poster);

  const latestEp = anime.episodes && anime.episodes.length > 0 ? anime.episodes[0] : null;
  const epNumber = latestEp ? latestEp.episodeNumber : null;
  
  // Memprioritaskan waktu dari latestEpisodeRelease (Denormalisasi), jika belum ada baru fallback
  const releaseTime = anime.latestEpisodeRelease || latestEp?.createdAt || anime.updatedAt;

  // Bersihkan judul dari tulisan SEO web asalnya
  const cleanTitle = anime.title.replace(/(Sub Indo|Nonton Anime).*$/i, "").trim();

  return (
    <Link
      href={`/anime/${anime.slug}`}
      className="group block overflow-hidden rounded-xl bg-neutral-900 ring-1 ring-neutral-800/80 transition duration-200 hover:-translate-y-1 hover:ring-brand/60 hover:shadow-lg hover:shadow-black/40"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-800">
        {cleanPoster && !imgError ? (
          <Image
            src={cleanPoster}
            alt={cleanTitle}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
            unoptimized
            priority={priority}
            className="object-cover object-top transition-transform duration-300 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-xs text-neutral-500">
            Tidak ada gambar
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-lg">
            ▶
          </span>
        </div>

        {anime.rating != null && anime.rating > 0 && (
          <span className="absolute right-1.5 top-1.5 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold text-yellow-400 backdrop-blur-sm">
            ★ {formatRating(anime.rating)}
          </span>
        )}

        {epNumber !== null && (
          <span className="absolute left-1.5 bottom-1.5 rounded-md bg-brand px-2 py-0.5 text-[10px] font-extrabold text-white shadow">
            Ep {epNumber}
          </span>
        )}
      </div>

      <div className="p-2.5">
        <p className="line-clamp-2 text-sm font-semibold text-neutral-100 transition-colors group-hover:text-brand-light" title={cleanTitle}>
          {cleanTitle}
        </p>
        
        <div className="mt-1 flex items-center justify-between text-[11px] text-neutral-400">
          <span className="truncate max-w-[65%]">
            {anime.type || "TV"} {anime.status ? `• ${anime.status}` : ""}
          </span>
          {releaseTime && (
            <span className="shrink-0 text-[10px] font-medium text-neutral-400">
              {timeAgo(releaseTime)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function AnimeCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 w-full animate-pulse">
      <div className="aspect-[3/4] w-full rounded-lg bg-neutral-800"></div>
      <div className="h-4 w-3/4 rounded bg-neutral-700"></div>
      <div className="h-4 w-1/2 rounded bg-neutral-700 mt-1"></div>
    </div>
  );
}