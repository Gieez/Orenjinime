import type { SourceAdapter, EpisodeItem } from "../adapters/types";

export async function getEpisodesList(
  adapter: SourceAdapter,
  html: string
): Promise<EpisodeItem[]> {
  return await adapter.getEpisodesList(html);
}