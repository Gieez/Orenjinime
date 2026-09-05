export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> },
) {
  // Rate limit: 60 req/min/IP
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(`episodes:${ip}`, 60, 60_000);
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { slug } = await props.params;

    const anime = await prisma.anime.findUnique({ where: { slug } });
    if (!anime) {
      return NextResponse.json({ error: "Anime tidak ditemukan" }, { status: 404 });
    }

    const episodes = await prisma.episode.findMany({
      where: { animeId: anime.id },
      orderBy: { episodeNumber: "asc" },
    });

    return NextResponse.json({ data: episodes });
  } catch (error) {
    console.error("Error episodes:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
