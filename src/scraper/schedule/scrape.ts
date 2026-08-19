import { upsertSchedule, recordFailedUrl } from "../persist/upsert";
import type { SourceAdapter } from "../adapters/types";
import { logger } from "../utils/logger";

export async function runScheduleScrape(adapter: SourceAdapter): Promise<void> {
  try {
    const schedules = await adapter.getSchedule("");
    for (const item of schedules) {
      await upsertSchedule(item);
    }
  } catch (error: any) {
    logger.error("SCRAPER", "Error running schedule scrape", error);
  }
}