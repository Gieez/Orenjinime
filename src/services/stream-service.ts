import { prisma } from "@/lib/prisma";
import { NugiAnimeAdapter } from "@/scraper/adapters/nuginime-adapter";
import { HttpClient } from "@/scraper/http-client";

const adapter = new NugiAnimeAdapter();

export async function getFullEpisodeWithFallback(
  episodeId: string,
  sourceUrl: string | null
) {
  let fullEpisode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { streamSources: true, subtitles: true },
  });

  if (fullEpisode && fullEpisode.streamSources.length === 0 && sourceUrl) {
    try {
      const cleanUrl = sourceUrl
        .replace(/^https?:\/\/?https?:\/\//i, "https://") 
        .replace(/^https?:\/\/https\/\//i, "https://");

      console.log(`[Stream Fallback] Mengambil streaming dari: ${cleanUrl}`);

      const html = await HttpClient.getHtml(cleanUrl);

      if (html && fullEpisode) { // 👈 Safety check fullEpisode not null
        const sources = adapter.parseStreamSources(html);

        if (sources.length > 0) {
          await prisma.streamSource.deleteMany({
            where: { episodeId: fullEpisode.id },
          });

          const streamData = sources
            .filter((src) => Boolean(src.url))
            .map((src) => ({
              episodeId: fullEpisode!.id, // 👈 Non-null assertion aman di sini
              name: src.name || "Server Utama",
              url: src.url,
              type: src.type || "embed",
              quality: src.quality ?? "HD",
            }));

          if (streamData.length > 0) {
            await prisma.streamSource.createMany({ data: streamData });
          }

          fullEpisode = await prisma.episode.findUnique({
            where: { id: episodeId },
            include: { streamSources: true, subtitles: true },
          });
        }
      }
    } catch (error) {
      console.error(`[Stream Scrape Error] Gagal scrape Episode ID ${episodeId}:`, error);
    }
  }

  return fullEpisode;
}