export class HttpClient {
  static async getHtml(url: string): Promise<string> {
    const safeUrl = url
      .replace(/^https?:\/\/?https?:\/\//i, "https://")
      .replace(/^https?:\/\/https\/\//i, "https://");

    try {
      const response = await fetch(safeUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP Error Status: ${response.status}`);
      }

      const html = await response.text();
      return html;
    } catch (error: any) {
      console.error(`[HttpClient Error] Gagal mengambil HTML dari ${safeUrl}:`, error.message);
      throw error;
    }
  }
}