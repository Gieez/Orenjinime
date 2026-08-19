"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimeCard, AnimeCardSkeleton, AnimeCardData } from "@/components/AnimeCard";

// Tambahkan isLocal (jika belum ada di tipe aslinya)
interface ExtendedAnimeCardData extends AnimeCardData {
  isLocal?: boolean;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<ExtendedAnimeCardData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const json = await res.json();
        setResults(json.data ?? []);
      } catch {
        // ignore aborted request
      } finally {
        setLoading(false);
      }
    }, 400); // debounce

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.replace(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold text-white">Cari Anime</h1>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">
            🔍
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul anime..."
            autoFocus
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900 py-4 pl-11 pr-4 text-sm text-white outline-none ring-0 transition placeholder:text-neutral-500 focus:border-brand"
          />
        </div>
      </form>

      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <AnimeCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && results.length === 0 && query.trim() && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-sm text-neutral-400">
          Tidak ada hasil untuk &quot;{query}&quot;.
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {results.map((a) => (
            <div key={a.slug} className="relative group">
              <AnimeCard anime={a} />
              
              {/* BINTANG UTAMA: Label LIVE untuk anime yang belum ada di DB */}
              {a.isLocal === false && (
                <span className="absolute top-2 right-2 z-10 rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white shadow-lg">
                  LIVE
                </span>
              )}
            </div>
          ))}
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