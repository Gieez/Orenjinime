import { NextResponse } from "next/server";
import { ScraperSyncService } from "@/scraper/persist/sync";

// Set batas waktu fungsi Vercel ke maksimum (60 detik)
export const maxDuration = 60; 

const CRON_SECRET = process.env.CRON_SECRET || 'rahasia_negara_123';

export async function POST(req: Request) {
  // 1. KEAMANAN: Wajibkan Header Authorization
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    
    // 2. TIMEOUT PROTECTION: Batasi maksimal halaman di Vercel (contoh: max 3-5 halaman)
    const rawPages = parseInt(body.pages || "2", 10);
    const safePages = Math.min(Math.max(rawPages, 1), 5).toString();

    const syncService = new ScraperSyncService();
    const result = await syncService.syncCatalog(safePages);

    return NextResponse.json({
      success: true,
      message: `Scraping completed successfully (${safePages} pages)`,
      processedCount: result.processedCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || "Internal Server Error" 
      },
      { status: 500 }
    );
  }
}