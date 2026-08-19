import type { SourceAdapter, AnimeDetail } from "../adapters/types";

export async function getAnimeDetails(
  adapter: SourceAdapter,
  html: string,
  url: string
): Promise<AnimeDetail> {
  return await adapter.getAnimeDetails(html, url);
}