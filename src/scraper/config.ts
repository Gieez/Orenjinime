export const scraperConfig = {
  sourceBaseUrl: process.env.SOURCE_BASE_URL ?? "https://nuginime.com",
  scheduleUrl: process.env.SCHEDULE_URL ?? "",
  concurrency: Number(process.env.SCRAPER_CONCURRENCY ?? 3),
  delayMs: Number(process.env.SCRAPER_DELAY_MS ?? 800),
  maxPages: Number(process.env.SCRAPER_MAX_PAGES ?? 50),
  timeoutMs: Number(process.env.SCRAPER_TIMEOUT_MS ?? 15000),
  maxRetries: Number(process.env.SCRAPER_MAX_RETRIES ?? 3),
  userAgent: "NugiAnimeBot/1.0 (+kampus-project; contact: you@example.com)",
};
