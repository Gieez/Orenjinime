export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> | { slug: string } }
) {
  try {
    const resolvedParams = await params;
    const { slug } = resolvedParams;

    // Cari anime & rekomendasinya
    const anime = await prisma.anime.findUnique({
      where: { slug },
      select: { id: true }
    });

    if (!anime) {
      return NextResponse.json({ error: "Anime tidak ditemukan" }, { status: 404 });
    }

    // Isi dengan logika query rekomendasi lu
    const recommendations = await prisma.anime.findMany({
      take: 10,
      where: { NOT: { id: anime.id } }
    });

    return NextResponse.json({ data: recommendations }, { status: 200 });

  } catch (error) {
    console.error("Error recommendations:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}