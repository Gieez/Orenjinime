import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const revalidate = 3600; // ISR: genres change rarely

export async function GET(request: Request) {
  // Rate limit: 60 req/min/IP
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`genres:${ip}`, 60, 60_000);
  if (!rateLimit.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const genres = await prisma.genre.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { animes: true } } },
  });

  return NextResponse.json({
    data: genres.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      animeCount: g._count.animes,
    })),
  });
}
