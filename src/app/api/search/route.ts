import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { NugiAnimeAdapter } from "@/scraper/adapters/nuginime-adapter";
import { AnimeStatus, AnimeType } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";

const adapter = new NugiAnimeAdapter();

async function fetchSearchPage(url: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `curl -s -L --max-time 15 -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" -H "Accept-Language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7" -H "Referer: https://v2.samehadaku.how/" "${url}"`,
      { maxBuffer: 5 * 1024 * 1024 }
    );

    if (!stdout || stdout.length < 500) return null;

    const hasRealContent =
      stdout.includes("/anime/") ||
      stdout.includes("entry-title") ||
      stdout.includes("post-show");

    if (!hasRealContent) {
      console.log(`[Search] curl: no real content (${stdout.length} chars)`);
      return null;
    }

    return stdout;
  } catch (err: any) {
    console.log(`[Search] curl error: ${err?.message}`);
    return null;
  }
}

export async function GET(request: Request) {
  // Rate limit: 60 requests per minute per IP
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`search:${ip}`, 60, 60_000);

  if (!rateLimit.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests. Try again later." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
          "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ success: true, data: [] });
  }

  try {
    // 1) Cari di DB dulu — optimized query
    const localResults = await prisma.anime.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { alternativeTitle: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 20,
      orderBy: [
        { latestOrder: { sort: "asc", nulls: "last" } },
        { rating: { sort: "desc", nulls: "last" } },
      ],
      include: {
        episodes: { take: 1, orderBy: { episodeNumber: "desc" } },
      },
    });

    // 2) Kalau hasil DB < 5, scrape live dari Samehadaku sebagai fallback
    let liveResults: any[] = [];
    if (localResults.length < 5) {
      try {
        const searchUrl = `https://v2.samehadaku.how/?s=${encodeURIComponent(query)}`;
        console.log(`[Search] Live scraping: ${searchUrl}`);
        const html = await fetchSearchPage(searchUrl);

        if (html) {
          const liveItems = adapter.parseSearch(html);
          console.log(`[Search] Live scrape OK: ${liveItems.length} results`);

          // Filter yang belum ada di DB
          const localSlugs = new Set(localResults.map((a) => a.slug));
          liveResults = liveItems
            .filter((item) => !localSlugs.has(item.slug))
            .slice(0, 10)
            .map((item) => ({
              id: `live_${item.slug}`,
              title: item.title,
              slug: item.slug,
              poster: item.poster,
              status: item.status || AnimeStatus.ONGOING,
              type: item.type || AnimeType.TV,
              rating: item.rating,
              sourceUrl: item.sourceUrl,
              episodes: [],
              isLive: true,
            }));
        }
      } catch (err) {
        console.error("[Search] Live scrape error:", err);
      }
    }

    return NextResponse.json({
      success: true,
      data: [
        ...localResults.map((a) => ({ ...a, isLocal: true })),
        ...liveResults,
      ],
    });
  } catch (error: any) {
    console.error("[API Search Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
