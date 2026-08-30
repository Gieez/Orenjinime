import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

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
    // DB-only search — no live scraping (scraping handled by GitHub Actions cron)
    const results = await prisma.anime.findMany({
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

    return NextResponse.json({
      success: true,
      data: results.map((a) => ({ ...a, isLocal: true })),
    });
  } catch (error: any) {
    console.error("[API Search Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
