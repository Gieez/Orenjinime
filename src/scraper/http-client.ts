export class HttpClient {
  static async getHtml(url: string): Promise<string> {
    const safeUrl = url
      .replace(/^https?:\/\/?https?:\/\//i, "https://")
      .replace(/^https?:\/\/https\/\//i, "https://");

    const browserHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
      "Referer": "https://v2.samehadaku.how/",
    };

    // 1. Opsi Utama: Fetch Langsung
    try {
      const response = await fetch(safeUrl, {
        headers: browserHeaders,
        cache: "no-store",
      });

      if (response.ok) {
        return await response.text();
      }

      console.warn(`[HttpClient Warning] Direct fetch gagal status ${response.status}, mencoba proxy...`);
    } catch (err: any) {
      console.warn(`[HttpClient Warning] Direct fetch error: ${err.message}, mencoba proxy...`);
    }

    // 2. Opsi Cadangan: Pake Proxy kalau kena 403 / IP Vercel terblokir
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(safeUrl)}`;
      const proxyResponse = await fetch(proxyUrl, { cache: "no-store" });

      if (!proxyResponse.ok) {
        throw new Error(`Proxy HTTP Error Status: ${proxyResponse.status}`);
      }

      return await proxyResponse.text();
    } catch (error: any) {
      console.error(`[HttpClient Error] Gagal total fetch & proxy dari ${safeUrl}:`, error.message);
      throw error;
    }
  }
}