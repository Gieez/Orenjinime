export class HttpClient {
  static async getHtml(url: string): Promise<string> {
    const safeUrl = url
      .replace(/^https?:\/\/?https?:\/\//i, "https://")
      .replace(/^https?:\/\/https\/\//i, "https://");

    // Daftar jalur fetch: Direct -> CorsProxy -> AllOrigins -> CodeTabs
    const fetchTargets = [
      { name: "Direct", url: safeUrl },
      { name: "CorsProxy", url: `https://corsproxy.io/?${encodeURIComponent(safeUrl)}` },
      { name: "AllOrigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(safeUrl)}` },
      { name: "CodeTabs", url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(safeUrl)}` },
    ];

    for (let i = 0; i < fetchTargets.length; i++) {
      const target = fetchTargets[i];
      try {
        console.log(`[HttpClient] Percobaan ${i + 1}/${fetchTargets.length} via ${target.name}...`);

        const response = await fetch(target.url, {
          headers: target.name === "Direct"
            ? {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
                "Referer": "https://v2.samehadaku.how/",
              }
            : {},
          cache: "no-store",
        });

        if (response.ok) {
          const html = await response.text();
          
          // Verifikasi HTML bukan proteksi Cloudflare "Just a moment..."
          if (html && !html.includes("Just a moment...") && !html.includes("Enable JavaScript")) {
            console.log(`[HttpClient] SUKSES mengambil HTML via ${target.name}!`);
            return html;
          }
          console.warn(`[HttpClient] ${target.name} mengembalikan halaman Cloudflare challenge, lanjut ke proxy berikutnya...`);
        } else {
          console.warn(`[HttpClient] ${target.name} gagal dengan HTTP Status: ${response.status}`);
        }
      } catch (err: any) {
        console.warn(`[HttpClient] Error pada ${target.name}: ${err.message}`);
      }
    }

    throw new Error("Semua jalur fetch & proxy gagal melewatin proteksi Samehadaku.");
  }
}