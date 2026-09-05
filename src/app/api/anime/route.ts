export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(_req: NextRequest) {
  // Rate limit: 60 req/min/IP
  const ip = getClientIp(_req);
  const rateLimit = checkRateLimit(`anime:${ip}`, 60, 60_000);
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const animeList = await prisma.anime.findMany({
      take: 20,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ data: animeList }, { status: 200 });
  } catch (error) {
    console.error("Error GET /api/anime:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
