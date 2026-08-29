import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpClient } from "@/scraper/http-client";

const DAY_MAP: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 0,
};

const DAY_URL_MAP: Record<string, string> = {
  Monday: "monday",
  Tuesday: "tuesday",
  Wednesday: "wednesday",
  Thursday: "thursday",
  Friday: "friday",
  Saturday: "saturday",
  Sunday: "sunday",
};

const DAY_NAME_TO_NUM: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 0,
};

interface SamehadakuScheduleItem {
  id: number;
  slug: string;
  title: string;
  url: string;
  content: string;
  featured_img_src: string | null;
  genre: string;
  east_score: string;
  east_type: string;
  east_schedule: string | null;
  east_time: string | null;
}

async function fetchAllDaysFromApi(): Promise<SamehadakuScheduleItem[]> {
  const all: SamehadakuScheduleItem[] = [];
  for (const [dayName, daySlug] of Object.entries(DAY_URL_MAP)) {
    try {
      console.log(`[Schedule] Fetching ${dayName}...`);
      const raw = await HttpClient.getJson(
        `https://v2.samehadaku.how/wp-json/custom/v1/all-schedule?perpage=500&day=${daySlug}`
      );
      const items: SamehadakuScheduleItem[] = JSON.parse(raw);
      for (const item of items) {
        all.push({ ...item, east_schedule: dayName });
      }
    } catch (err) {
      console.error(`[Schedule] Gagal fetch ${daySlug}:`, err);
    }
  }
  return all;
}

async function scrapeScheduleFromApi(): Promise<void> {
  console.log("[Schedule] Scraping SEMUA hari dari WP-JSON API...");
  const items = await fetchAllDaysFromApi();
  console.log(`[Schedule] Total: ${items.length} items`);

  let count = 0;
  for (const item of items) {
    const dayNum = DAY_NAME_TO_NUM[item.east_schedule || "Monday"] ?? 1;

    // Cari atau buat anime
    let anime = await prisma.anime.findUnique({ where: { slug: item.slug } });

    if (!anime) {
      const cleanTitle = item.title.replace(/\s*Sub\s*Indo\s*$/i, "").trim();
      const cleanSynopsis = (item.content || "").replace(/samehadaku/gi, "OrenJiNime");
      try {
        anime = await prisma.anime.create({
          data: {
            title: cleanTitle,
            slug: item.slug,
            synopsis: cleanSynopsis || null,
            poster: item.featured_img_src || null,
            status: "ONGOING",
            type: item.east_type || "TV",
            rating: item.east_score ? parseFloat(item.east_score) : null,
            sourceUrl: item.url,
          },
        });
      } catch {
        continue;
      }
    }

    // Parse jam tayang
    const timeMatch = item.east_time?.match(/(\d{1,2}[:.]\d{2})/);
    const airTime = timeMatch ? timeMatch[1].replace(".", ":") : item.east_time || "00:00";

    // Upsert schedule
    await prisma.schedule.upsert({
      where: {
        animeId_dayOfWeek: { animeId: anime.id, dayOfWeek: dayNum },
      },
      update: { airTime },
      create: {
        animeId: anime.id,
        dayOfWeek: dayNum,
        airTime,
      },
    });
    count++;
  }

  console.log(`[Schedule] Sync selesai: ${count} entries`);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const day = searchParams.get("day") || "monday";

  try {
    const dayOfWeek = DAY_MAP[day];

    if (dayOfWeek === undefined) {
      return NextResponse.json({ error: "Invalid day parameter" }, { status: 400 });
    }

    // Cek apakah ada data di DB
    let schedules = await prisma.schedule.findMany({
      where: { dayOfWeek },
      include: {
        anime: {
          select: { title: true, slug: true, poster: true, type: true, rating: true },
        },
      },
    });

    // Kalau kosong → scrape dari API
    if (schedules.length === 0) {
      console.log(`[Schedule] Day ${day} kosong, scraping dari API...`);
      await scrapeScheduleFromApi();

      schedules = await prisma.schedule.findMany({
        where: { dayOfWeek },
        include: {
          anime: {
            select: { title: true, slug: true, poster: true, type: true, rating: true },
          },
        },
      });
    }

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
