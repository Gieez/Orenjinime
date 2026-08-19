export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
  try {
    const animeList = await prisma.anime.findMany({
      take: 20,
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ data: animeList }, { status: 200 });
  } catch (error: any) {
    console.error("Error GET /api/anime:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}