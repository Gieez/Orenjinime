export const maxDuration = 60; // Maksimal 60 detik di Vercel Pro/Hobby tertentu

import { NextResponse } from 'next/server';
import { ScraperSyncService } from '@/scraper/persist/sync'; // Sesuaikan path jika berbeda

const CRON_SECRET = process.env.CRON_SECRET || 'rahasia_negara_123';

export async function POST(request: Request) {
  // 1. Amankan endpoint dengan Secret Header dari cron-job.org
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Ambil parameter tipe sync dari query URL (contoh: /api/sync?type=fast)
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'fast';

  const scraper = new ScraperSyncService();

  try {
    if (type === 'fast') {
      // Fast sync: Fokus update katalog halaman 1-2 & Top 10 (Aman untuk Vercel)
      const result = await scraper.syncCatalog("2", 1);
      return NextResponse.json({ 
        success: true, 
        message: 'Fast sync completed successfully', 
        data: result 
      });
    } 
    
    if (type === 'deep') {
      // Deep sync: Jika butuh halaman lebih banyak, tapi hati-hati dengan limit Vercel
      const pages = searchParams.get('pages') || "5";
      const result = await scraper.syncCatalog(pages, 1);
      return NextResponse.json({ 
        success: true, 
        message: 'Deep sync completed successfully', 
        data: result 
      });
    }

    return NextResponse.json({ error: 'Invalid sync type' }, { status: 400 });

  } catch (error: any) {
    console.error('[API Sync Error]:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}