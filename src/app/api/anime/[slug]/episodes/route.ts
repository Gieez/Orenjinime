export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
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
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}