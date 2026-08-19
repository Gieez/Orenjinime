import { prisma } from "./src/lib/prisma";
import { ScraperSyncService } from "./src/scraper/persist/sync";

async function main() {
  console.log("🔄 Mereset topOrder di database...");
  await prisma.anime.updateMany({
    data: { topOrder: null },
  });

  console.log("🚀 Menjalankan sync scraper baru...");
  const syncService = new ScraperSyncService();
  await syncService.syncCatalog("1", 1);

  console.log("✅ Reset dan Sync selesai!");
}

main()
  .catch((e) => {
    console.error("❌ Error saat reset:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });