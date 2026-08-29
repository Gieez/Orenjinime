"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getContinueWatching,
  type WatchHistoryEntry,
} from "@/lib/watch-history";

export function ContinueWatching() {
  const [entries, setEntries] = useState<WatchHistoryEntry[]>([]);

  useEffect(() => {
    setEntries(getContinueWatching());
  }, []);

  if (entries.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-neutral-100">Lanjut Nonton</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {entries.map((entry) => (
          <Link
            key={`${entry.slug}-${entry.episodeNumber}`}
            href={`/watch/${entry.slug}/${entry.episodeNumber}`}
            className="group relative flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 transition hover:border-brand"
          >
            <div className="relative aspect-[2/3] w-full overflow-hidden bg-neutral-950">
              {entry.poster ? (
                <img
                  src={entry.poster}
                  alt={entry.title}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
                  No Image
                </div>
              )}
              {/* Continue badge */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-lg">
                  &#9654;
                </span>
              </div>
              {/* Episode badge */}
              <span className="absolute left-2 top-2 rounded bg-brand/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                Ep {entry.episodeNumber}
              </span>
            </div>
            <div className="flex-1 p-3">
              <h3 className="text-xs font-semibold text-neutral-200 line-clamp-2 group-hover:text-brand sm:text-sm">
                {entry.title}
              </h3>
              <p className="mt-1 text-[10px] text-neutral-500">
                {formatTimeAgo(entry.watchedAt)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "Baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}j lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d lalu`;
  return `${Math.floor(days / 30)}bln lalu`;
}
