import { prisma } from "../lib/prisma";
import { HttpClient } from "./http-client";
import { NugiAnimeAdapter } from "./adapters/nuginime-adapter";
import { ScraperSyncService } from "./persist/sync";
import { logger } from "./utils/logger";

const adapter = new NugiAnimeAdapter();
const service = new ScraperSyncService();

// Indonesian day slugs used by samehadaku
const SCHEDULE_DAYS = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu"];

type JobName = "catalog" | "backfill" | "schedule" | "all";

function parseJobArg(): JobName {
  const arg = process.argv.find((a) => a.startsWith("--job="));
  const value = arg?.split("=")[1];
  if (value === "catalog" || value === "backfill" || value === "schedule" || value === "all") {
    return value;
  }
  return "all";
}

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.log("SCRAPER", `Received ${signal}, closing database connection...`);
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

async function main() {
  const job = parseJobArg();
  logger.log("SCRAPER", `Running scraper job: [${job.toUpperCase()}]`);

  try {
    if (job === "catalog" || job === "all") {
      logger.log("SCRAPER", "→ STEP A: catalog (homepage + katalog + episodes + streams)");
      const result = await service.syncCatalog("2", 1);
      logger.log(
        "SCRAPER",
        `STEP A done. processed=${result.processedCount}, newEps=${result.totalNewEpisodes}, newStreams=${result.totalNewStreams}`,
      );
    }

    if (job === "backfill" || job === "all") {
      logger.log("SCRAPER", "→ STEP B: backfill streams for episodes missing sources");
      const result = await service.backfillStreams(200);
      logger.log(
        "SCRAPER",
        `STEP B done. anime=${result.animeProcessed}, eps=${result.episodesProcessed}, streams=${result.streamsAdded}, failed=${result.failed}`,
      );
    }

    if (job === "schedule" || job === "all") {
      logger.log("SCRAPER", "→ STEP C: schedule (all 7 days, ongoing only)");
      const result = await service.syncSchedule();
      const synced = result.synced ?? 0;
      const skipped = result.skipped ?? 0;
      logger.log("SCRAPER", `STEP C done. synced=${synced}, skipped=${skipped}`);
    }

    logger.log("SCRAPER", "All tasks completed successfully.");
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    logger.error("SCRAPER", `Error running scraper: ${errMessage}`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
