import { NextResponse } from "next/server";
import { chromium } from "playwright";

// Objek untuk menyimpan cache di memori server
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_DURATION = 1000 * 60 * 30; // Cache berlaku 30 menit

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const day = searchParams.get("day") || "monday";
  const now = Date.now();

  // 1. Cek apakah cache tersedia dan belum kadaluarsa
  if (cache[day] && now - cache[day].timestamp < CACHE_DURATION) {
    console.log(`[CACHE HIT] Menggunakan data cache untuk: ${day}`);
    return NextResponse.json(cache[day].data);
  }

  // 2. Jika tidak ada cache, jalankan Playwright
  console.log(`[CACHE MISS] Fetching data baru untuk: ${day}`);
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    await page.goto("https://v2.samehadaku.how/", { waitUntil: "domcontentloaded", timeout: 30000 });

    const apiResponse = await page.evaluate(async (targetDay) => {
      const res = await fetch(`https://v2.samehadaku.how/wp-json/custom/v1/all-schedule?perpage=20&day=${targetDay}`);
      return await res.json();
    }, day);

    await browser.close();

    // 3. Simpan ke cache
    cache[day] = { data: apiResponse, timestamp: now };

    return NextResponse.json(apiResponse);
  } catch (error: any) {
    if (browser) await browser.close();
    return NextResponse.json({ error: "Gagal memuat data", details: error.message }, { status: 500 });
  }
}