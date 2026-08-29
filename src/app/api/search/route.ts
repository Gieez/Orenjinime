import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ success: true, data: [] });
  }

  try {
    // DB-only search — NO live scraping from Vercel
    const localResults = await prisma.anime.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { alternativeTitle: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 20,
      orderBy: [
        { latestOrder: { sort: "asc", nulls: "last" } },
        { rating: { sort: "desc", nulls: "last" } },
      ],
      include: {
        episodes: { take: 1, orderBy: { episodeNumber: "desc" } },
      },
    });

    return NextResponse.json({
      success: true,
      data: localResults.map((a) => ({ ...a, isLocal: true })),
    });
  } catch (error: any) {
    console.error("[API Search Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
