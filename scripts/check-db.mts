import { prisma } from "../src/lib/prisma";
const counts: Record<number, number> = {};
for (let d = 0; d < 7; d++) counts[d] = 0;
const all = await prisma.schedule.findMany({
  select: {
    dayOfWeek: true,
    anime: { select: { title: true, slug: true } },
    airTime: true,
  },
});
console.log("Total entries:", all.length);
for (const s of all) {
  counts[s.dayOfWeek] = (counts[s.dayOfWeek] || 0) + 1;
}
const dayNames = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
for (let d = 0; d < 7; d++) {
  const sample = all.find((s) => s.dayOfWeek === d);
  console.log(
    `${d} (${dayNames[d]}): ${counts[d]} — sample: ${sample?.anime.title} @ ${sample?.airTime}`,
  );
}
await prisma.$disconnect();
