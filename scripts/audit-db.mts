import { prisma } from "../src/lib/prisma";

const total = await prisma.anime.count();
const noEps = await prisma.anime.count({ where: { episodes: { none: {} } } });
const epsCount = await prisma.episode.count();
const streamCount = await prisma.streamSource.count();
const proxyStream = await prisma.streamSource.count({ where: { url: { startsWith: "/api/player/embed" } } });
const directStream = await prisma.streamSource.count({ where: { NOT: { url: { startsWith: "/api/player/embed" } } } });

// Anime with episodes but no streams
const epsNoStream = await prisma.anime.count({
  where: { episodes: { some: { streamSources: { none: {} } } } }
});

// Anime with episodes, all episodes have streams
const epsWithStream = await prisma.anime.count({
  where: {
    episodes: { some: {} },
    NOT: { episodes: { some: { streamSources: { none: {} } } } },
  },
});

console.log("=== ANIME TOTALS ===");
console.log(`Total anime: ${total}`);
console.log(`No episodes: ${noEps}`);
console.log(`Episodes w/o streams: ${epsNoStream}`);
console.log(`Fully synced (eps + streams): ${epsWithStream}`);

console.log("\n=== EPISODE TOTALS ===");
console.log(`Total episodes: ${epsCount}`);
console.log(`Total stream sources: ${streamCount}`);
console.log(`Proxy URLs (still need resolve): ${proxyStream}`);
console.log(`Direct URLs: ${directStream}`);

console.log("\n=== TOP 10 BY RECENT ===");
const recent = await prisma.anime.findMany({
  where: { latestOrder: { not: null } },
  take: 10,
  orderBy: { latestOrder: "asc" },
  include: { _count: { select: { episodes: true } } },
});
for (const a of recent) {
  console.log(`  ${a.latestOrder}. ${a.title} — ${a._count.episodes} eps`);
}

console.log("\n=== ANIME ONGOING (no eps yet) ===");
const ongoingNoEps = await prisma.anime.findMany({
  where: { status: "ONGOING", episodes: { none: {} } },
  take: 20,
  select: { slug: true, title: true, topOrder: true, latestOrder: true },
});
for (const a of ongoingNoEps) {
  console.log(`  ${a.title} (top=${a.topOrder}, latest=${a.latestOrder})`);
}
console.log(`  ... and ${Math.max(0, noEps - 20)} more`);

console.log("\n=== SCHEDULE COVERAGE ===");
const schedByDay: Record<number, number> = {};
for (let d = 0; d < 7; d++) {
  schedByDay[d] = await prisma.schedule.count({ where: { dayOfWeek: d } });
}
const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
for (let d = 0; d < 7; d++) {
  console.log(`  ${dayNames[d]}: ${schedByDay[d]}`);
}
await prisma.$disconnect();
