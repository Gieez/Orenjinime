import { prisma } from "../src/lib/prisma";
import { ScraperSyncService } from "../src/scraper/persist/sync";

/**
 * Run the full sync — invoked by GitHub Actions cron.
 *
 * Order:
 *  1. STEP A — syncCatalog (homepage + katalog + ALL episodes + streams for new eps)
 *  2. STEP B — backfillStreams (anime in DB with episodes but missing streams)
 *  3. STEP C — syncSchedule (all 7 days, ongoing only)
 *
 * Idempotent: rerunning with no samehadaku changes is a no-op (all skipped).
 */
async function runSync() {
  const startedAt = Date.now();
  console.log(`[Sync] ========== STARTED at ${new Date().toISOString()} ==========`);

  const service = new ScraperSyncService();

  // STEP A: homepage + katalog + episodes + streams
  try {
    const result = await service.syncCatalog("2", 1);
    console.log(
      `[Sync] STEP A done. processed=${result.processedCount}, newEps=${result.totalNewEpisodes}, newStreams=${result.totalNewStreams}`,
    );
  } catch (err) {
    console.error("[Sync] STEP A failed:", err);
  }

  // STEP B: backfill streams for anime whose episodes have no streamSources yet
  try {
    const result = await service.backfillStreams(200);
    console.log(
      `[Sync] STEP B done. anime=${result.animeProcessed}, eps=${result.episodesProcessed}, streams=${result.streamsAdded}, failed=${result.failed}`,
    );
  } catch (err) {
    console.error("[Sync] STEP B failed:", err);
  }

  // STEP C: schedule (only ongoing/active)
  try {
    const result = await service.syncSchedule();
    console.log(`[Sync] STEP C done. synced=${result.synced}, skipped=${result.skipped}`);
  } catch (err) {
    console.error("[Sync] STEP C failed:", err);
  }

  const elapsed = ((Date.now() - startedAt) / 1000 / 60).toFixed(1);
  console.log(`[Sync] ========== COMPLETED in ${elapsed} min ==========`);

  await prisma.$disconnect();
}

runSync().catch(async (err) => {
  console.error("[Sync] FATAL:", err);
  await prisma.$disconnect();
  process.exit(1);
});
