export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; episode: string }> | { slug: string; episode: string } },
) {
  // Rate limit: 30 req/min/IP (stricter — stream data)
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(`streams:${ip}`, 30, 60_000);
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const resolvedParams = await params;
    const { slug, episode } = resolvedParams;

    // Validate episode is a positive integer
    const episodeNum = parseInt(episode, 10);
    if (!Number.isFinite(episodeNum) || episodeNum < 1) {
      return NextResponse.json({ error: "Invalid episode" }, { status: 400 });
    }

    const anime = await prisma.anime.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!anime) {
      return NextResponse.json({ error: "Anime tidak ditemukan" }, { status: 404 });
    }

    const episodeData = await prisma.episode.findFirst({
      where: {
        animeId: anime.id,
        episodeNumber: episodeNum,
      },
      include: {
        streamSources: true,
        subtitles: true,
      },
    });

    if (!episodeData) {
      return NextResponse.json({ error: "Episode tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ data: episodeData }, { status: 200 });
  } catch (error) {
    console.error("Error fetching streams:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
