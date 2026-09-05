import { prisma } from "../src/lib/prisma";
import { NugiAnimeAdapter } from "../src/scraper/adapters/nuginime-adapter";

const adapter = new NugiAnimeAdapter();

let cursor: string | undefined = undefined;
const batchSize = 5;
let totalEpisodesProcessed = 0;
let totalStreamsResolved = 0;
let totalStreamsFailed = 0;

while (true) {
  const eps = await prisma.episode.findMany({
    where: { sourceUrl: { contains: "v2.samehadaku.how" } },
    include: { streamSources: true, anime: { select: { slug: true, title: true } } },
    orderBy: { id: "asc" },
    take: batchSize,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
  if (eps.length === 0) break;

  for (const ep of eps) {
    const proxyUrls = ep.streamSources.map((s) => s.url).filter((u) => u.startsWith("/api/player/embed"));
    if (proxyUrls.length === 0) {
      totalEpisodesProcessed++;
      cursor = ep.id;
      continue;
    }
    const resolved = await adapter.resolveStreamUrls(proxyUrls);
    if (resolved.size > 0) {
      for (const stream of ep.streamSources) {
        const direct = resolved.get(stream.url);
        if (direct && direct !== stream.url) {
          await prisma.streamSource.update({ where: { id: stream.id }, data: { url: direct } });
          totalStreamsResolved++;
        } else {
          totalStreamsFailed++;
        }
      }
    } else {
      totalStreamsFailed += proxyUrls.length;
    }
    totalEpisodesProcessed++;
    cursor = ep.id;
    console.log(`[${totalEpisodesProcessed}] ${ep.anime.title} ep ${ep.episodeNumber}: resolved ${resolved.size}/${proxyUrls.length}`);
  }
}
console.log(`\nDONE. Episodes: ${totalEpisodesProcessed}, Resolved: ${totalStreamsResolved}, Failed: ${totalStreamsFailed}`);
await prisma.$disconnect();
