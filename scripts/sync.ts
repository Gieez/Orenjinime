import { prisma } from "../src/lib/prisma";
import { HttpClient } from "../src/scraper/http-client";
import { NugiAnimeAdapter } from "../src/scraper/adapters/nuginime-adapter";
import { upsertAnime, upsertEpisodes } from "../src/scraper/persist/upsert";

async function runSync() {
  console.log("🔄 Memulai sinkronisasi anime & episode otomatis...");
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
      console.log(`🔍 Scraping detail untuk: ${item.title} (${item.slug})`);
      
      try {
        // Ambil halaman detail anime individual
        const detailHtml = await HttpClient.getHtml(item.sourceUrl);
        if (detailHtml) {
          const detailData = adapter.parseAnimeDetail(detailHtml, item.sourceUrl);
          const episodeList = adapter.parseEpisodeList(detailHtml);

          // Simpan anime beserta genrenya menggunakan helper upsertAnime yang sudah ada
          const saved = await upsertAnime({
            ...detailData,
            slug: item.slug,
          });

          // Simpan daftar episodenya
          if (episodeList.length > 0) {
            await upsertEpisodes(saved.id, episodeList);
            console.log(`✅ Berhasil sync ${item.title}: ${episodeList.length} episode.`);
          }
        }
      } catch (err) {
        console.error(`⚠️ Gagal sync detail ${item.slug}:`, err);
      }

      // Beri jeda sikit agar tidak terlalu ngebut (anti rate-limit)
      await new Promise((res) => setTimeout(res, 2000));
    }

    console.log("✨ Sinkronisasi selesai!");
  } catch (error) {
    console.error("❌ Error saat sinkronisasi:", error);
  }
}

runSync();