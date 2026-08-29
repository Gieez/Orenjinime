"use client";

import Link from "next/link";
import { useState } from "react";

interface Episode {
  id: string;
  episodeNumber: number;
  title?: string | null;
}

interface Props {
  episodes: Episode[];
  animeSlug: string;
  defaultVisible?: number;
}

const DEFAULT_VISIBLE = 24;

export function EpisodeList({ episodes, animeSlug, defaultVisible = DEFAULT_VISIBLE }: Props) {
  const [showAll, setShowAll] = useState(false);
  const visibleEpisodes = showAll ? episodes : episodes.slice(0, defaultVisible);
  const hasMore = episodes.length > defaultVisible;

  if (episodes.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-8 text-center text-sm text-zinc-400">
        Belum ada episode yang tersinkronisasi di database.
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {visibleEpisodes.map((ep) => (
          <Link
            key={ep.id}
            href={`/watch/${animeSlug}/${ep.episodeNumber}`}
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

      {/* Show All / Show Less button */}
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-6 py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-orange-500 hover:bg-orange-600 hover:text-white"
          >
            {showAll
              ? "Sembunyikan"
              : `Tampilkan Semua (${episodes.length} Episode)`}
          </button>
        </div>
      )}
    </div>
  );
}
