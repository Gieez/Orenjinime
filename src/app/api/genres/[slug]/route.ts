import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { paginationSchema } from "@/lib/validation";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const parsed = paginationSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { page, limit } = parsed.data;

  const genre = await prisma.genre.findUnique({ where: { slug: params.slug } });
  if (!genre) {
    return NextResponse.json({ error: "Genre tidak ditemukan" }, { status: 404 });
  }

  const where = { genres: { some: { genreId: genre.id } } };

  const [items, total] = await Promise.all([
    prisma.anime.findMany({
      where,
      orderBy: { popularity: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.anime.count({ where }),
  ]);

  return NextResponse.json({
    genre,
    data: items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
