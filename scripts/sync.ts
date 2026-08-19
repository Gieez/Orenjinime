import { prisma } from "../src/lib/prisma";
import { HttpClient } from "../src/scraper/http-client";
import { NugiAnimeAdapter } from "../src/scraper/adapters/nuginime-adapter";

async function runSync() {
  console.log("🔄 Memulai sinkronisasi anime otomatis...");
  try {
    const adapter = new NugiAnimeAdapter();
    const html = await HttpClient.getHtml(adapter.baseUrl);

    if (!html) {
      console.error("❌ Gagal mendapatkan HTML dari homepage.");
      return;
    }

    const animeList = adapter.parseHomepage(html);
    console.log(`📦 Ditemukan ${animeList.length} anime dari homepage.`);

    for (const item of animeList) {
      await prisma.anime.upsert({
        where: { slug: item.slug },
        update: {
          title: item.title,
          poster: item.poster,
          status: item.status || "ONGOING",
          rating: item.rating || 0,
        },
        create: {
          title: item.title,
          slug: item.slug,
          poster: item.poster,
          status: item.status || "ONGOING",
          rating: item.rating || 0,
        },
      });
    }

    console.log("✅ Sinkronisasi database selesai dengan sukses!");
  } catch (error) {
    console.error("❌ Error saat sinkronisasi:", error);
  } finally {
    await prisma.$disconnect();
  }
}

runSync();