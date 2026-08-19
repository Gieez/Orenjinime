import { prisma } from "../lib/prisma";
import { logger } from "./utils/logger";
import { NugiAnimeAdapter } from "./adapters/nuginime-adapter";
import { runScheduleScrape } from "./schedule/scrape";

const adapter = new NugiAnimeAdapter();

function parseJobArg(): "catalog" | "schedule" | "news" | "all" {
  const arg = process.argv.find((a) => a.startsWith("--job="));
  const value = arg?.split("=")[1];
  if (value === "catalog" || value === "schedule" || value === "news") return value;
  return "all";
}

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.log("SCRAPER", `Menerima ${signal}, menutup koneksi database...`);
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

async function main() {
  const job = parseJobArg();
  logger.log("SCRAPER", `Menjalankan job scraper: [${job.toUpperCase()}]`);

  try {
    if (job === "schedule" || job === "all") {
      logger.log("SCRAPER", "Memulai scraping schedule...");
      await runScheduleScrape(adapter);
    }

    logger.log("SCRAPER", "Semua task scraper selesai successfully.");
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    logger.error("SCRAPER", `Terjadi error saat menjalankan scraper: ${errMessage}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();