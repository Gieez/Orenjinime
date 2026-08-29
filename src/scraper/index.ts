import { prisma } from "../lib/prisma";
import { HttpClient } from "./http-client";
import { NugiAnimeAdapter } from "./adapters/nuginime-adapter";
import { logger } from "./utils/logger";
import { upsertSchedule } from "./persist/upsert";

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
    if (job === "schedule" || job === "all") {
      logger.log("SCRAPER", "Starting schedule scrape...");
      const html = await HttpClient.getHtml(adapter.baseUrl);
      if (html) {
        const schedules = await adapter.getSchedule(html);
        for (const item of schedules) {
          try {
            await upsertSchedule(item);
          } catch (err) {
            console.error(`[SCRAPER] Failed schedule ${item.animeSlug}:`, err);
          }
        }
        logger.log("SCRAPER", `Synced ${schedules.length} schedule entries.`);
      } else {
        logger.error("SCRAPER", "Failed to fetch homepage for schedule.");
      }
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
