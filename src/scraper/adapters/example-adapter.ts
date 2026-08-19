import { AnimeStatus } from "@prisma/client";
import type { SourceAdapter, CatalogItem, AnimeDetail, EpisodeItem, ScheduleItem, NewsItem, CatalogScrapeResult, StreamData } from "./types";
import { slugify } from "../../lib/slug";

export class ExampleAdapter implements SourceAdapter {
  baseUrl = "https://example.com";

  async scrapeCatalog(html: string): Promise<CatalogScrapeResult> {
    return {
      items: [],
      hasNextPage: false,
    };
  }

  async getAnimeDetails(html: string, url: string): Promise<AnimeDetail> {
    const title = "Example Anime";
    const slug = slugify(title);

    return {
      title,
      slug,
      sourceUrl: url,
      alternativeTitle: null,
      synopsis: "Example synopsis",
      poster: null,
      banner: null,
      year: 2024,
      status: AnimeStatus.ONGOING,
      type: null,
      studio: null,
      rating: null,
      popularity: 0,
      genres: [],
      producers: [],
    };
  }

  async getEpisodesList(html: string): Promise<EpisodeItem[]> {
    return [
      {
        episodeNumber: 1,
        title: "Episode 1",
        sourceUrl: `${this.baseUrl}/anime/example/episode-1`,
        releasedAt: new Date(),
      },
    ];
  }

  async getEpisodeStreams(html: string): Promise<StreamData> {
    return {
      streams: [],
      navigation: {
        previousUrl: null,
        allEpisodesUrl: null,
        nextUrl: null,
      },
    };
  }

  async getSchedule(html: string): Promise<ScheduleItem[]> {
    return [
      {
        animeSlug: "example-anime",
        animeSourceUrl: `${this.baseUrl}/anime/example`,
        airTime: "18:00",
        dayOfWeek: "MONDAY",
      },
    ];
  }

  async scrapeNews(html: string): Promise<NewsItem[]> {
    const title = "Example News Title";
    return [
      {
        title,
        slug: slugify(title),
        sourceUrl: `${this.baseUrl}/news/example`,
        synopsis: "Example news synopsis",
        content: "Example news content",
        thumbnail: undefined,
        publishedAt: new Date(),
      },
    ];
  }
}