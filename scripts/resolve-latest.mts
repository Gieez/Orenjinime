import { prisma } from "../src/lib/prisma";
import { NugiAnimeAdapter } from "../src/scraper/adapters/nuginime-adapter";

// Resolve only the LATEST N episodes (those most likely to be watched).
// Older episodes keep their proxy URL — embed endpoint still works for
// them in dev/local, just not on Vercel serverless.

const adapter = new NugiAnimeAdapter();
const LIMIT = 300;

const eps = await prisma.episode.findMany({
  where: {
    sourceUrl: { contains: "v2.samehadaku.how" },
    streamSources: { some: { url: { startsWith: "/api/player/embed" } } },
  },
  include: { streamSources: true, anime: { select: { slug: true, title: true } } },
  orderBy: { lastScrapedAt: "desc" },
  take: LIMIT,
});

console.log(`Resolving up to ${LIMIT} most-recent episodes with proxy URLs...`);
console.log(`Found ${eps.length} candidates.\n`);

let totalResolved = 0;
let totalFailed = 0;

for (let i = 0; i < eps.length; i++) {
  const ep = eps[i];
  const proxyUrls = ep.streamSources
    .map((s) => s.url)
    .filter((u) => u.startsWith("/api/player/embed"));

  if (proxyUrls.length === 0) continue;

  const resolved = await adapter.resolveStreamUrls(proxyUrls);

  for (const stream of ep.streamSources) {
    const direct = resolved.get(stream.url);
    if (direct && direct !== stream.url) {
      await prisma.streamSource.update({ where: { id: stream.id }, data: { url: direct } });
      totalResolved++;
    } else {
      totalFailed++;
    }
  }

  const pct = (((i + 1) / eps.length) * 100).toFixed(1);
  process.stdout.write(`\r[${i + 1}/${eps.length} (${pct}%)] Resolved: ${totalResolved} | Failed: ${totalFailed}   `);
}

console.log(
  `\n\nDONE. Total: ${totalResolved} resolved, ${totalFailed} failed (out of ${eps.length} episodes).`,
);
await prisma.$disconnect();
