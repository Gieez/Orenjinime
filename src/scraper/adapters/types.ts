import { AnimeStatus, AnimeType } from "@prisma/client";

export interface CatalogItem {
  title: string;
  slug: string;
  sourceUrl: string;
  poster?: string | null;
  status?: AnimeStatus | null;
  type?: AnimeType | null;
  rating?: number | null;
  /** Posisi anime pada katalog terbaru, 1-based. */
  latestOrder?: number | null;
}

export interface CatalogScrapeResult {
  items: CatalogItem[];
  hasNextPage: boolean;
  totalPages?: number;
}

export interface AnimeDetail {
  title: string;
  slug: string;
  alternativeTitle?: string | null;
  synopsis?: string | null;
  poster?: string | null;
  banner?: string | null;
  status: AnimeStatus;
  type?: AnimeType | null;
  year?: number | null;
  studio?: string | null;
  rating?: number | null;
  popularity?: number;
  sourceUrl: string;
  genres: string[];
  producers: string[];
  /** Posisi katalog terbaru jika data berasal dari katalog terbaru. */
  latestOrder?: number | null;
}

export interface EpisodeItem {
  episodeNumber: number;
  title?: string | null;
  sourceUrl: string;
  /** Waktu rilis yang sudah dinormalisasi menjadi Date. */
  releasedAt?: Date | null;
}

export interface StreamItem {
  name: string;
  url: string;
  quality?: string | null;
  type?: string | null;
}

export interface StreamData {
  streams: StreamItem[];
  navigation: {
    previousUrl?: string | null;
    allEpisodesUrl?: string | null;
    nextUrl?: string | null;
  };
}

export interface ScheduleItem {
  animeSlug?: string;
  animeSourceUrl?: string;
  airTime: string;
  dayOfWeek?: string;
}

export interface NewsItem {
  title: string;
  slug: string;
  synopsis?: string | null;
  content?: string | null;
  thumbnail?: string | null;
  sourceUrl: string;
  publishedAt?: Date | null;
}

export interface SourceAdapter {
  baseUrl: string;
  scrapeCatalog(html: string): Promise<CatalogScrapeResult>;
  getAnimeDetails(html: string, url: string): Promise<AnimeDetail>;
  getEpisodesList(html: string): Promise<EpisodeItem[]>;
  getEpisodeStreams(html: string): Promise<StreamData>;
  getSchedule(html: string): Promise<ScheduleItem[]>;
  scrapeNews?(html: string): Promise<NewsItem[]>;
}
