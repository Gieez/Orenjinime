export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> | { slug: string } }
) {
  const resolvedParams = await params;
  const { slug } = resolvedParams;

  const anime = await prisma.anime.findUnique({
    where: { slug },
    include: {
      genres: { include: { genre: true } },
      episodes: {
        orderBy: { episodeNumber: "asc" },
        include: { streamSources: true },
      },
      schedules: true,
    },
  });

  if (!anime) {
    return NextResponse.json({ error: "Anime tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({ data: anime });
}