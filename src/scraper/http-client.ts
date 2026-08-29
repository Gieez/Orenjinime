export class HttpClient {
  /**
   * Jalur utama: got-scraping — bypass Cloudflare TLS fingerprinting
   */
  private static async fetchViaGotScraping(url: string): Promise<string | null> {
    try {
      const { gotScraping } = await import("got-scraping");
      const response = await gotScraping({
        url,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
          Referer: "https://v2.samehadaku.how/",
        },
        timeout: { request: 15000 },
      });

      if (response.statusCode === 200 && response.body) {
        if (!response.body.includes("Just a moment...") && !response.body.includes("Enable JavaScript")) {
          return response.body;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Jalur fallback: native fetch via CORS proxy chain
   */
  private static async fetchViaProxy(url: string): Promise<string | null> {
    const safeUrl = url
      .replace(/^https?:\/\/https?:\/\//i, "https://")
      .replace(/^https?:\/\/https\/\//i, "https://");

    const fetchTargets = [
      { name: "Direct", url: safeUrl },
      { name: "CorsProxy", url: `https://corsproxy.io/?${encodeURIComponent(safeUrl)}` },
      { name: "AllOrigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(safeUrl)}` },
      { name: "CodeTabs", url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(safeUrl)}` },
    ];

    for (const target of fetchTargets) {
      try {
        const response = await fetch(target.url, {
          headers:
            target.name === "Direct"
              ? {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
                  Referer: "https://v2.samehadaku.how/",
                }
              : {},
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });

        if (response.ok) {
          const html = await response.text();
          if (html && !html.includes("Just a moment...") && !html.includes("Enable JavaScript")) {
            return html;
          }
        }
      } catch {
        // skip to next proxy
      }
    }
    return null;
  }

  static async getHtml(url: string): Promise<string> {
    // Jalur 1: got-scraping (bypass Cloudflare)
    console.log(`[HttpClient] Mencoba got-scraping...`);
    const gotResult = await this.fetchViaGotScraping(url);
    if (gotResult) {
      console.log(`[HttpClient] SUKSES via got-scraping!`);
      return gotResult;
    }

    // Jalur 2: Proxy chain fallback
    console.log(`[HttpClient] got-scraping gagal, mencoba proxy chain...`);
    const proxyResult = await this.fetchViaProxy(url);
    if (proxyResult) {
      console.log(`[HttpClient] SUKSES via proxy!`);
      return proxyResult;
    }

    throw new Error("Semua jalur fetch & proxy gagal melewatin proteksi Samehadaku.");
  }
}
