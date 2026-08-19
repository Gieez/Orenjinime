import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpClient } from "@/scraper/http-client";
import { NugiAnimeAdapter } from "@/scraper/adapters/nuginime-adapter";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  console.log("🔥 API /api/search DIPANGGIL!");

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ success: true, data: [] });
  }

  try {
    const adapter = new NugiAnimeAdapter();

    // 1. CARI DI DATABASE LOKAL
    const localResults = await prisma.anime.findMany({
  where: {
    OR: [
      { title: { contains: query, mode: "insensitive" } },
      { alternativeTitle: { contains: query, mode: "insensitive" } },
    ],
  },
  take: 15,
});

console.log(`[DB] Ditemukan lokal: ${localResults.length} anime`);

// BINTANG UTAMA: Jika lokal ada data, LANGSUNG RETURN! (Bikin pencarian <50ms)
if (localResults.length > 0) {
  return NextResponse.json({
    success: true,
    data: localResults.map((a) => ({ ...a, isLocal: true })),
  });
}

    // 2. CARI SECARA LIVE KE SAMEHADAKU
    let liveResults: any[] = [];
    try {
      const searchUrl = `${adapter.baseUrl}/?s=${encodeURIComponent(query)}&post_type=anime`;
      console.log(`[LIVE SEARCH] Mencoba mengambil dari URL: ${searchUrl}`);

      const html = await HttpClient.getHtml(searchUrl);

      if (html) {
        console.log(`[LIVE SEARCH] Sukses! Panjang HTML: ${html.length}`);
        // PERHATIKAN: Pastikan di adapter nama method-nya parseSearch, bukan parseSearchResults
        liveResults = adapter.parseSearch(html); 
        console.log(`[LIVE SEARCH] Hasil parsing: ${liveResults.length} anime`);
      }
    } catch (liveError) {
      console.error("[LIVE SEARCH ERROR]:", liveError);
    }

    // 3. GABUNGKAN & HAPUS DUPLIKAT
    const localSlugs = new Set(localResults.map((anime) => anime.slug));
    
    const combinedResults = [
      ...localResults.map((a) => ({ ...a, isLocal: true })),
      ...liveResults
        .filter((item) => !localSlugs.has(item.slug))
        .map((item) => ({
          id: `live-${item.slug}`,
          title: item.title,
          slug: item.slug,
          poster: item.poster,
          status: item.status || "ONGOING",
          rating: item.rating || 0,
          isLocal: false,
        })),
    ];

    // Response BUKAN menggunakan pagination lagi
    return NextResponse.json({ success: true, data: combinedResults });

  } catch (error: any) {
    console.error("[API ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}