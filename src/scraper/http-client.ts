import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class HttpClient {
  /**
   * Fetch HTML via curl — bypass Cloudflare TLS fingerprint detection.
   * Curl punya TLS fingerprint yang beda dari Node.js fetch / got-scraping,
   * jadi Cloudflare ga block.
   */
  static async getHtml(url: string): Promise<string> {
    console.log(`[HttpClient] Fetching via curl: ${url}`);

    const stdout = await this.curl(url);
    if (!stdout || stdout.length < 500) {
      throw new Error("Response terlalu pendek / kosong");
    }

    // Cek apakah ada real content
    const hasRealContent =
      stdout.includes("/anime/") ||
      stdout.includes("entry-title") ||
      stdout.includes("lstepsiode") ||
      stdout.includes("post-show") ||
      stdout.includes("wp-admin") ||
      stdout.includes("itemprop");

    if (!hasRealContent) {
      throw new Error("Response tidak mengandung konten real (kemungkinan Cloudflare block)");
    }

    console.log(`[HttpClient] SUKSES via curl! (${stdout.length} chars)`);
    return stdout;
  }

  /**
   * Fetch JSON API via curl — skip HTML validation karena JSON ga punya HTML markers.
   */
  static async getJson(url: string): Promise<string> {
    console.log(`[HttpClient] Fetching JSON via curl: ${url}`);

    const stdout = await this.curl(url);
    if (!stdout || stdout.length < 20) {
      throw new Error("JSON response kosong");
    }

    // JSON valid? Coba parse quick
    try {
      JSON.parse(stdout);
    } catch {
      throw new Error("Response bukan JSON valid (kemungkinan Cloudflare block)");
    }

    console.log(`[HttpClient] SUKSES JSON via curl! (${stdout.length} chars)`);
    return stdout;
  }

  private static async curl(url: string): Promise<string> {
    try {
      const { stdout } = await execAsync(
        `curl -s -L --max-time 20 ` +
        `-H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" ` +
        `-H "Accept-Language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7" ` +
        `-H "Referer: https://v2.samehadaku.how/" ` +
        `-H "Accept: application/json" ` +
        `"${url}"`,
        { maxBuffer: 10 * 1024 * 1024 }
      );
      return stdout;
    } catch (err: any) {
      console.error(`[HttpClient] curl gagal: ${err?.message}`);
      throw new Error("Fetch gagal melewatin proteksi Samehadaku.");
    }
  }
}
