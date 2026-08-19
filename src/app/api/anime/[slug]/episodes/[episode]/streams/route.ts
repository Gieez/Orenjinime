export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string; episode: string }> | { slug: string; episode: string } }
) {
  try {
    const resolvedParams = await params;
    const { slug, episode } = resolvedParams;

    // 1. Cari anime berdasarkan slug
    const anime = await prisma.anime.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!anime) {
      return NextResponse.json({ error: "Anime tidak ditemukan" }, { status: 404 });
    }

    // 2. Cari episode beserta streamSources & subtitles
    const episodeData = await prisma.episode.findFirst({
      where: {
        animeId: anime.id,
        episodeNumber: parseInt(episode, 10) || 1
      },
      include: {
        streamSources: true,
        subtitles: true,
      }
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