// src/scheduler/seed.ts
import { ScraperSyncService } from "../scraper/persist/sync";
import { logger } from "../scraper/utils/logger";

const syncService = new ScraperSyncService();

async function runMassiveScrape() {
  logger.log("SCRAPER", "🚀 Memulai proses seed massal database...");
  
  try {
    const targetPages = "769"; 
    const startPage = 7; // Ubah jika ingin lanjut dari halaman tertentu (misal: 10, 50, dst)
    
    const result = await syncService.syncCatalog(targetPages, startPage);

    logger.log(
      "SCRAPER",
      `✅ Scraping massal selesai! Berhasil memproses total: ${result.processedCount} anime ke database.`
    );
  } catch (error: any) {
    logger.log("SCRAPER", `❌ Gagal melakukan scraping massal: ${error.message}`);
  } finally {
    process.exit(0);
  }
}

runMassiveScrape();