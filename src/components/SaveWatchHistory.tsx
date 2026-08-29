"use client";

import { useEffect } from "react";
import { saveToWatchHistory } from "@/lib/watch-history";

interface Props {
  slug: string;
  title: string;
  poster: string | null;
  episodeNumber: number;
}

/**
 * Invisible component — auto-saves to localStorage when episode page loads.
 */
export function SaveWatchHistory({ slug, title, poster, episodeNumber }: Props) {
  useEffect(() => {
    saveToWatchHistory({ slug, title, poster, episodeNumber });
  }, [slug, title, poster, episodeNumber]);

  return null;
}
