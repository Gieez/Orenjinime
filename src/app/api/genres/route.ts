import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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
