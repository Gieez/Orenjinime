"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";

interface Episode {
  id: string;
  episodeNumber: number;
  title?: string | null;
}

interface Props {
  episodes: Episode[];
  animeSlug: string;
  defaultVisible?: number;
  currentEpisode?: number;
}

export function EpisodeList({ episodes, animeSlug, defaultVisible = 24, currentEpisode }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position for arrow visibility
  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      window.addEventListener("resize", checkScroll);
      return () => {
        el.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      };
    }
  }, []);

  // Scroll to current episode on mount
  useEffect(() => {
    if (currentEpisode && scrollRef.current) {
      const idx = episodes.findIndex((ep) => ep.episodeNumber === currentEpisode);
      if (idx >= 0) {
        const el = scrollRef.current;
        const children = el.children;
        if (children[idx]) {
          (children[idx] as HTMLElement).scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
      }
    }
  }, [currentEpisode, episodes]);

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.6;
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  }

  if (episodes.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-8 text-center text-sm text-zinc-400">
        Belum ada episode yang tersinkronisasi di database.
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Scroll Arrows */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800/90 border border-neutral-700 text-neutral-300 shadow-lg transition hover:bg-neutral-700 hover:text-white"
          aria-label="Geser kiri"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800/90 border border-neutral-700 text-neutral-300 shadow-lg transition hover:bg-neutral-700 hover:text-white"
          aria-label="Geser kanan"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Fade edges */}
      {canScrollLeft && <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#09090b] to-transparent z-[5]" />}
      {canScrollRight && <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#09090b] to-transparent z-[5]" />}

      {/* Episode Scroll Container */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {episodes.map((ep) => {
          const isCurrent = currentEpisode === ep.episodeNumber;
          return (
            <Link
              key={ep.id}
              href={`/watch/${animeSlug}/${ep.episodeNumber}`}
              className={`group flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border transition-all duration-200 sm:h-16 sm:w-16 ${
                isCurrent
                  ? "border-brand bg-brand/20 shadow-lg shadow-brand/20"
                  : "border-zinc-800 bg-zinc-900/80 hover:border-orange-500 hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-600/20"
              } active:scale-95`}
            >
              <div className={`text-[9px] font-semibold uppercase tracking-wider ${
                isCurrent ? "text-brand" : "text-zinc-500 group-hover:text-white/80"
              }`}>
                Ep
              </div>
              <div className={`text-base font-black sm:text-lg ${
                isCurrent ? "text-brand" : "text-zinc-100 group-hover:text-white"
              }`}>
                {ep.episodeNumber}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Episode count info */}
      <div className="mt-3 text-center text-xs text-neutral-500">
        {episodes.length} Episode tersedia
        {currentEpisode && (
          <span className="ml-2 text-brand">• Sedang menonton Ep {currentEpisode}</span>
        )}
      </div>
    </div>
  );
}
