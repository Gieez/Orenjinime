"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  getContinueWatching,
  type WatchHistoryEntry,
} from "@/lib/watch-history";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/anime", label: "Anime" },
  { href: "/schedule", label: "Jadwal" },
  { href: "/dukungan", label: "Dukungan" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [continueEntries, setContinueEntries] = useState<WatchHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setContinueEntries(getContinueWatching());
  }, []);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchQuery("");
        setSearchResults([]);
      }
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json();
        setSearchResults(data.data || []);
      } catch {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  function handleSearchSelect() {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  }

  // Shared search dropdown content
  function renderSearchDropdown(isMobile: boolean) {
    return (
      <div className={`absolute top-full mt-2 rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl shadow-black/50 overflow-hidden ${
        isMobile ? "right-0 w-80" : "left-0 right-0"
      }`}>
        <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-neutral-500">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchQuery.trim().length >= 2) {
                window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
                handleSearchSelect();
              }
            }}
            placeholder="Ketik judul anime..."
            className="w-full bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-500"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(""); setSearchResults([]); }} className="text-neutral-500 hover:text-neutral-300">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {searchLoading && (
            <div className="px-4 py-6 text-center text-sm text-neutral-500">Mencari...</div>
          )}
          {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-neutral-500">Anime tidak ditemukan</div>
          )}
          {!searchLoading && searchResults.slice(0, 8).map((anime: any) => (
            <Link
              key={anime.slug}
              href={`/anime/${anime.slug}`}
              onClick={handleSearchSelect}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-neutral-800"
            >
              {anime.poster ? (
                <img src={anime.poster} alt="" className="h-12 w-9 shrink-0 rounded object-cover" />
              ) : (
                <div className="h-12 w-9 shrink-0 rounded bg-neutral-800" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium text-neutral-100 truncate">{anime.title}</div>
                <div className="text-xs text-neutral-500">
                  {anime.episodes?.[0] ? `Ep. ${anime.episodes[0].episodeNumber}` : anime.status || "Anime"}
                </div>
              </div>
            </Link>
          ))}
          {!searchLoading && searchQuery.length < 2 && (
            <div className="px-4 py-6 text-center text-xs text-neutral-600">
              Ketik minimal 2 karakter untuk mencari
            </div>
          )}
        </div>
        {/* Tampilkan Semua */}
        {!searchLoading && searchQuery.trim().length >= 2 && (
          <div className="border-t border-neutral-800">
            <Link
              href={`/search?q=${encodeURIComponent(searchQuery.trim())}`}
              onClick={handleSearchSelect}
              className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-brand transition hover:bg-neutral-800"
            >
              Tampilkan Semua Hasil
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* ===== DESKTOP ===== */}
        {/* Logo — hidden on mobile */}
        <Link href="/" className="hidden text-lg font-extrabold tracking-tight text-white shrink-0 sm:inline">
          Oren<span className="text-brand">JiNime</span>
        </Link>

        {/* Search bar — desktop */}
        <div className="hidden sm:flex flex-1 justify-center px-8" ref={searchContainerRef}>
          <div className="relative w-full max-w-md">
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="flex w-full items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900/80 px-4 py-2.5 text-sm text-neutral-400 transition hover:border-neutral-500 hover:text-neutral-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" strokeLinecap="round" />
              </svg>
              Cari anime...
            </button>
            {searchOpen && renderSearchDropdown(false)}
          </div>
        </div>

        {/* Nav links — desktop */}
        <div className="hidden items-center gap-1 text-sm font-medium sm:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-md px-3 py-2 transition-colors ${
                  active ? "text-brand" : "text-neutral-300 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          {/* Continue Watching dropdown */}
          {continueEntries.length > 0 && (
            <div className="relative" ref={historyRef}>
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm transition-colors ${
                  historyOpen ? "text-brand" : "text-neutral-300 hover:text-white"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Lanjut Nonton
              </button>
              {historyOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl shadow-black/50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-neutral-800">
                    <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Lanjut Nonton</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {continueEntries.slice(0, 8).map((entry) => (
                      <Link
                        key={`${entry.slug}-${entry.episodeNumber}`}
                        href={`/watch/${entry.slug}/${entry.episodeNumber}`}
                        onClick={() => setHistoryOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 transition hover:bg-neutral-800"
                      >
                        {entry.poster ? (
                          <img src={entry.poster} alt="" className="h-10 w-8 shrink-0 rounded object-cover" />
                        ) : (
                          <div className="h-10 w-8 shrink-0 rounded bg-neutral-800" />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm text-neutral-200 truncate">{entry.title}</div>
                          <div className="text-xs text-neutral-500">Ep {entry.episodeNumber}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ===== MOBILE ===== */}
        {/* Hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-300 hover:bg-neutral-900 hover:text-white sm:hidden"
          aria-label="Buka menu"
        >
          {mobileOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          )}
        </button>

        {/* Logo — mobile only */}
        <Link href="/" className="text-lg font-extrabold tracking-tight text-white sm:hidden" onClick={() => setMobileOpen(false)}>
          Oren<span className="text-brand">JiNime</span>
        </Link>

        {/* Search icon — mobile */}
        <div className="relative sm:hidden">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-300 hover:bg-neutral-900 hover:text-white"
            aria-label="Cari anime"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" strokeLinecap="round" />
            </svg>
          </button>
          {searchOpen && renderSearchDropdown(true)}
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="border-t border-neutral-800 bg-neutral-950 px-4 py-3 sm:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-md px-3 py-2.5 text-sm font-medium ${
                    active ? "bg-brand/10 text-brand" : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {continueEntries.length > 0 && (
              <div className="border-t border-neutral-800 mt-2 pt-2">
                <span className="px-3 py-1 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Lanjut Nonton</span>
                {continueEntries.slice(0, 5).map((entry) => (
                  <Link
                    key={`${entry.slug}-${entry.episodeNumber}`}
                    href={`/watch/${entry.slug}/${entry.episodeNumber}`}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-neutral-300 hover:bg-neutral-900 hover:text-white"
                  >
                    {entry.poster ? (
                      <img src={entry.poster} alt="" className="h-8 w-6 shrink-0 rounded object-cover" />
                    ) : (
                      <div className="h-8 w-6 shrink-0 rounded bg-neutral-800" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-xs">{entry.title}</div>
                      <div className="text-[10px] text-neutral-500">Ep {entry.episodeNumber}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
