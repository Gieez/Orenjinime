import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const COMMON_HEADERS: Record<string, string> = {
  "User-Agent": USER_AGENT,
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: "https://v2.samehadaku.how/",
};

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
      `[${label}] Response tidak mengandung konten real (kemungkinan Cloudflare block)`
    );
  }

  return html;
}

/**
 * Jalur 1: got-scraping — bypass Cloudflare TLS fingerprinting.
 * TLS fingerprint Chrome-like, jadi Cloudflare ga block.
 */
async function fetchViaGotScraping(url: string): Promise<string | null> {
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

/**
 * Jalur 2: curl — bypass Cloudflare di beberapa environment.
 * Curl TLS fingerprint berbeda dari Node.js, kadang bypass Cloudflare.
 */
async function fetchViaCurl(url: string): Promise<string | null> {
  try {
    const command = `curl -s -L --max-time 20 ` +
      `-H "User-Agent: ${USER_AGENT}" ` +
      `-H "Accept-Language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7" ` +
      `-H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" ` +
      `-H "Referer: https://v2.samehadaku.how/" ` +
      `"${url}"`;

    const { stdout } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
    if (stdout && stdout.length > 500) {
      console.log(`[HttpClient] curl SUKSES: ${url} (${stdout.length} chars)`);
      return stdout;
    }
    console.warn(`[HttpClient] curl response kosong/pendek: ${url}`);
    return null;
  } catch (err: any) {
    console.warn(`[HttpClient] curl gagal: ${err?.message}`);
    return null;
  }
}

export class HttpClient {
  /**
   * Fetch HTML — got-scraping primary, curl fallback.
   * Kedua method bypass Cloudflare TLS fingerprinting.
   */
  static async getHtml(url: string): Promise<string> {
    console.log(`[HttpClient] Fetching: ${url}`);

    // Jalur 1: got-scraping (Chrome TLS fingerprint)
    let html = await fetchViaGotScraping(url);
    if (html) return validateHtml(html, "got-scraping");

    // Jalur 2: curl (different TLS fingerprint)
    console.log(`[HttpClient] got-scraping gagal, fallback ke curl...`);
    html = await fetchViaCurl(url);
    if (html) return validateHtml(html, "curl");

    throw new Error(
      `[HttpClient] Semua metode gagal fetch: ${url} (Cloudflare block)`
    );
  }

  /**
   * Fetch JSON API — got-scraping primary, curl fallback.
   * Skip HTML validation karena JSON ga punya HTML markers.
   */
  static async getJson(url: string): Promise<string> {
    console.log(`[HttpClient] Fetching JSON: ${url}`);

    // Jalur 1: got-scraping
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

    // Jalur 2: curl
    try {
      const { stdout } = await execAsync(
        `curl -s -L --max-time 15 ` +
          `-H "User-Agent: ${USER_AGENT}" ` +
          `-H "Accept: application/json" ` +
          `-H "Referer: https://v2.samehadaku.how/" ` +
          `"${url}"`,
        { maxBuffer: 10 * 1024 * 1024 }
      );
      if (stdout && stdout.length > 20) {
        JSON.parse(stdout); // Validate JSON
        console.log(`[HttpClient] curl JSON SUKSES: ${url}`);
        return stdout;
      }
    } catch (err: any) {
      console.warn(`[HttpClient] curl JSON gagal: ${err?.message}`);
    }

    throw new Error(`[HttpClient] Semua metode gagal fetch JSON: ${url}`);
  }
}
