/**
 * HTTP client for scraper — uses got-scraping (Chrome TLS fingerprint) to
 * bypass Cloudflare. No child_process / execAsync — avoids command injection.
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const COMMON_HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: "https://v2.samehadaku.how/",
};

/** Whitelist — only samehadaku.how family is allowed */
const ALLOWED_HOSTS = ["samehadaku.how", "v2.samehadaku.how"];

function isAllowedUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return ALLOWED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith("." + h));
  } catch {
    return false;
  }
}

function validateHtml(html: string, label: string): string {
  if (!html || html.length < 500) {
    throw new Error(`[${label}] Response terlalu pendek / kosong`);
  }

  const hasRealContent =
    html.includes("/anime/") ||
    html.includes("entry-title") ||
    html.includes("lstepsiode") ||
    html.includes("post-show") ||
    html.includes("wp-admin") ||
    html.includes("itemprop") ||
    html.includes("east_player_option") ||
    html.includes("player-option") ||
    html.includes("data-post");

  if (!hasRealContent) {
    throw new Error(
      `[${label}] Response tidak mengandung konten real (kemungkinan Cloudflare block)`,
    );
  }

  return html;
}

async function fetchViaGotScraping(url: string): Promise<string | null> {
  if (!isAllowedUrl(url)) {
    console.warn(`[HttpClient] Rejected non-allowed URL: ${url}`);
    return null;
  }
  try {
    const { gotScraping } = await import("got-scraping");
    const response = await gotScraping({
      url,
      headers: {
        ...COMMON_HEADERS,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
      timeout: { request: 20000 },
    });

    if (response.statusCode === 200 && response.body) {
      console.log(`[HttpClient] got-scraping SUKSES: ${url} (${response.body.length} chars)`);
      return response.body;
    }
    console.warn(`[HttpClient] got-scraping HTTP ${response.statusCode}: ${url}`);
    return null;
  } catch (err: any) {
    console.warn(`[HttpClient] got-scraping gagal: ${err?.message}`);
    return null;
  }
}

async function fetchViaNative(url: string): Promise<string | null> {
  if (!isAllowedUrl(url)) {
    console.warn(`[HttpClient] Rejected non-allowed URL: ${url}`);
    return null;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(url, {
      headers: {
        ...COMMON_HEADERS,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (response.ok) {
      const html = await response.text();
      if (html && html.length > 500) {
        console.log(`[HttpClient] native fetch SUKSES: ${url} (${html.length} chars)`);
        return html;
      }
    }
    console.warn(`[HttpClient] native fetch HTTP ${response.status}: ${url}`);
    return null;
  } catch (err: any) {
    console.warn(`[HttpClient] native fetch gagal: ${err?.message}`);
    return null;
  }
}

export class HttpClient {
  /**
   * Fetch HTML — got-scraping primary, native fetch fallback.
   * No execAsync/curl — avoids command injection.
   */
  static async getHtml(url: string): Promise<string> {
    console.log(`[HttpClient] Fetching: ${url}`);

    let html = await fetchViaGotScraping(url);
    if (html) return validateHtml(html, "got-scraping");

    console.log(`[HttpClient] got-scraping gagal, fallback ke native...`);
    html = await fetchViaNative(url);
    if (html) return validateHtml(html, "native");

    throw new Error(
      `[HttpClient] Semua metode gagal fetch: ${url} (Cloudflare block)`,
    );
  }

  /**
   * Fetch JSON — got-scraping primary, native fetch fallback.
   * Skip HTML validation because JSON has no HTML markers.
   */
  static async getJson(url: string): Promise<string> {
    console.log(`[HttpClient] Fetching JSON: ${url}`);

    try {
      const { gotScraping } = await import("got-scraping");
      const response = await gotScraping({
        url,
        headers: {
          ...COMMON_HEADERS,
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        timeout: { request: 15000 },
      });

      if (response.statusCode === 200 && response.body) {
        try {
          JSON.parse(response.body);
          console.log(`[HttpClient] got-scraping JSON SUKSES: ${url}`);
          return response.body;
        } catch {
          console.warn(`[HttpClient] got-scraping response bukan JSON valid`);
        }
      }
    } catch (err: any) {
      console.warn(`[HttpClient] got-scraping JSON gagal: ${err?.message}`);
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, {
        headers: {
          ...COMMON_HEADERS,
          Accept: "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);
      if (response.ok) {
        const stdout = await response.text();
        if (stdout && stdout.length > 20) {
          JSON.parse(stdout);
          console.log(`[HttpClient] native JSON SUKSES: ${url}`);
          return stdout;
        }
      }
    } catch (err: any) {
      console.warn(`[HttpClient] native JSON gagal: ${err?.message}`);
    }

    throw new Error(`[HttpClient] Semua metode gagal fetch JSON: ${url}`);
  }
}
