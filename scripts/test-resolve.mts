import { prisma } from "../src/lib/prisma";
import { NugiAnimeAdapter } from "../src/scraper/adapters/nuginime-adapter";

const adapter = new NugiAnimeAdapter();
const ep = await prisma.episode.findFirst({
  where: { sourceUrl: { contains: "v2.samehadaku.how" } },
  orderBy: { lastScrapedAt: "desc" },
  include: { streamSources: true },
});

if (!ep || !ep.sourceUrl) {
  console.log("No episode with sourceUrl");
  process.exit(0);
}

console.log(`Resolving streams for ep ${ep.episodeNumber} (id ${ep.id})...`);
const proxyUrls = ep.streamSources.map((s) => s.url).filter((u) => u.startsWith("/api/player/embed"));
console.log(`Proxy URLs to resolve: ${proxyUrls.length}`);
const resolved = await adapter.resolveStreamUrls(proxyUrls);
console.log(`Resolved: ${resolved.size}`);
for (const [proxy, direct] of resolved) {
  console.log(`  ${proxy.substring(0, 60)} → ${direct.substring(0, 80)}`);
}
await prisma.$disconnect();
