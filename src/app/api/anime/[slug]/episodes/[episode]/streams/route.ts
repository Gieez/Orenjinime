import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> | { slug: string } }
) {
  try {
    const resolvedParams = await params;
    const { slug } = resolvedParams;

    // Cari anime berdasarkan slug
    const anime = await prisma.anime.findUnique({
      where: { slug },
      select: { id: true } // Optimasi: kita hanya butuh ID-nya saja
    });

    if (!anime) {
      return NextResponse.json({ error: "Anime tidak ditemukan" }, { status: 404 });
    }

    // Ambil SEMUA episode untuk anime tersebut
    const episodes = await prisma.episode.findMany({
      where: { animeId: anime.id },
      orderBy: { episodeNumber: 'desc' }, // Mengurutkan dari episode terbaru ke terlama
      select: {
        id: true,
        episodeNumber: true,
        title: true,
        releasedAt: true,
      }
    });

    return NextResponse.json({ data: episodes }, { status: 200 });

  } catch (error) {
    console.error("Error fetching episodes:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}