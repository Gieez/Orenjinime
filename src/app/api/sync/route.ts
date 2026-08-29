import { NextResponse } from 'next/server';

/**
 * POST /api/sync — DEPRECATED for live scraping.
 * Syncing is now handled by GitHub Actions cron job + scripts/sync.ts.
 * This endpoint is kept for backward compatibility but no longer triggers scraping.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  return NextResponse.json({
    success: true,
    message: "Syncing is now handled by GitHub Actions cron (every 3 hours). This endpoint no longer triggers live scraping. Use `npm run sync` locally or trigger the GitHub Actions workflow manually.",
  });
}
