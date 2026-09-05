import { prisma } from "../src/lib/prisma";
const eps = await prisma.episode.findMany({ take: 5, include: { streamSources: true } });
for (const e of eps) {
  console.log(`Ep ${e.episodeNumber} (${e.animeId.substring(0,8)}): ${e.streamSources.length} streams`);
  for (const s of e.streamSources) {
    console.log(`  - ${s.name}: ${s.url.substring(0, 60)}`);
  }
}
await prisma.$disconnect();
