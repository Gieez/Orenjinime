import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DAY_MAP: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const day = searchParams.get("day") || "monday";

  try {
    const dayOfWeek = DAY_MAP[day];

    if (dayOfWeek === undefined) {
      return NextResponse.json(
        { error: "Invalid day parameter" },
        { status: 400 }
      );
    }

    // Read schedule from DB — populated by cron job
    const schedules = await prisma.schedule.findMany({
      where: { dayOfWeek },
      include: {
        anime: {
          select: {
            title: true,
            slug: true,
            poster: true,
            type: true,
            rating: true,
          },
        },
      },
    });

    const result = schedules.map((s) => ({
      title: s.anime.title,
      url: `/anime/${s.anime.slug}`,
      featured_img_src: s.anime.poster,
      east_type: s.anime.type,
      east_score: s.anime.rating?.toFixed(1) || "N/A",
      genre: "",
      east_time: s.airTime,
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Schedule API Error]:", error);
    return NextResponse.json(
      { error: "Gagal memuat data", details: error.message },
      { status: 500 }
    );
  }
}
