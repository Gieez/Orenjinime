"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimeCard, AnimeCardSkeleton, AnimeCardData } from "@/components/AnimeCard";

interface ExtendedAnimeCardData extends AnimeCardData {
  isLocal?: boolean;
  isLive?: boolean;
  sourceUrl?: string;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<ExtendedAnimeCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!initialQ);

  // Search only on Enter key or submit button — NOT on every keystroke
  const doSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim() || searchQuery.trim().length < 2) {
        setResults([]);
        setHasSearched(false);
        return;
      }

      setLoading(true);
      setHasSearched(true);

      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(searchQuery.trim())}`
        );
        const json = await res.json();
        setResults(json.data ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Auto-search dari URL param ?q= (pas refresh / share link)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialQ && initialQ.trim().length >= 2) {
      doSearch(initialQ);
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Update URL for shareability
    router.replace(`/search?q=${encodeURIComponent(query.trim())}`);
    // Fire the search
    doSearch(query);
  }

  // Allow Enter key to trigger search (input already handles this via form submit)
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e as any);
    }
  }

  // Handle click pada live result: langsung navigate — server akan
  // construct source URL dari slug di /anime/[slug] page
  function handleLiveResultClick(_e: React.MouseEvent, _anime: ExtendedAnimeCardData) {
    // No cookie needed — server constructs URL safely from slug
  }

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold text-white">Cari Anime</h1>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">
            &#128269;
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ketik judul anime, lalu Enter..."
            autoFocus
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-4 pl-11 pr-24 text-sm text-white outline-none ring-0 transition placeholder:text-neutral-500 focus:border-brand"
          />
          <button
            type="submit"
            disabled={!query.trim() || query.trim().length < 2}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cari
          </button>
        </div>
      </form>

      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <AnimeCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && hasSearched && results.length === 0 && query.trim() && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-sm text-neutral-400">
          Tidak ada hasil untuk &quot;{query}&quot;.
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {results.map((a) => (
            <div key={a.slug} className="relative group">
              <AnimeCard
                anime={a}
                href={`/anime/${a.slug}`}
                onClick={a.isLive ? (e) => handleLiveResultClick(e, a) : undefined}
              />
            </div>
          ))}
        </div>
      )}

      {!hasSearched && !loading && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-sm text-neutral-500">
          Ketik judul anime yang ingin dicari, lalu tekan Enter atau klik tombol Cari.
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div>
          <h1 className="mb-5 text-2xl font-bold text-white">Cari Anime</h1>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <AnimeCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
