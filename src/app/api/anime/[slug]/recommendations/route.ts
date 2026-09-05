export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> | { slug: string } },
) {
  // Rate limit: 60 req/min/IP
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(`reco:${ip}`, 60, 60_000);
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const resolvedParams = await params;
    const { slug } = resolvedParams;

    const anime = await prisma.anime.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!anime) {
      return NextResponse.json({ error: "Anime tidak ditemukan" }, { status: 404 });
    }

    const recommendations = await prisma.anime.findMany({
      take: 10,
      where: { NOT: { id: anime.id } },
    });

    return NextResponse.json({ data: recommendations }, { status: 200 });
  } catch (error) {
    console.error("Error recommendations:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
