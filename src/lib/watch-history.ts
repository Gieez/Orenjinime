/**
 * Watch History — localStorage-based, per-device.
 * Simpan: slug, episode number, title, poster, timestamp.
 * Max 30 entries.
 */

export interface WatchHistoryEntry {
  slug: string;
  title: string;
  poster: string | null;
  episodeNumber: number;
  watchedAt: number; // timestamp ms
}

const STORAGE_KEY = "orenjinime_watch_history";
const MAX_ENTRIES = 30;

export function getWatchHistory(): WatchHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw === "undefined" || raw === "null") return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    // Corrupted data — clear it
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return [];
  }
}

export function saveToWatchHistory(entry: Omit<WatchHistoryEntry, "watchedAt">) {
  if (typeof window === "undefined") return;
  try {
    const history = getWatchHistory();

    // Remove existing entry for same slug+episode (avoid duplicates)
    const filtered = history.filter(
      (h) => !(h.slug === entry.slug && h.episodeNumber === entry.episodeNumber)
    );

    // Add new entry at the beginning
    const updated = [
      { ...entry, watchedAt: Date.now() },
      ...filtered,
    ].slice(0, MAX_ENTRIES);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage might be full or blocked
  }
}

export function getContinueWatching(): WatchHistoryEntry[] {
  const history = getWatchHistory();
  // Group by slug, keep only the latest episode per anime
  const latestBySlug = new Map<string, WatchHistoryEntry>();
  for (const entry of history) {
    const existing = latestBySlug.get(entry.slug);
    if (!existing || entry.episodeNumber > existing.episodeNumber) {
      latestBySlug.set(entry.slug, entry);
    }
  }
  // Return sorted by most recently watched, max 10
  return Array.from(latestBySlug.values())
    .sort((a, b) => b.watchedAt - a.watchedAt)
    .slice(0, 10);
}

export function removeFromWatchHistory(slug: string) {
  if (typeof window === "undefined") return;
  try {
    const history = getWatchHistory();
    const updated = history.filter((h) => h.slug !== slug);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}
