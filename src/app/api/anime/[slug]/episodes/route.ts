import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const anime = await prisma.anime.findUnique({ where: { slug: params.slug } });
  if (!anime) {
    return NextResponse.json({ error: "Anime tidak ditemukan" }, { status: 404 });
  }

  const episodes = await prisma.episode.findMany({
    where: { animeId: anime.id },
    orderBy: { episodeNumber: "asc" },
  });

  return NextResponse.json({ data: episodes });
}
