export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const EMBED_URL = "https://v2.samehadaku.how/wp-admin/admin-ajax.php";
const REFERER = "https://v2.samehadaku.how/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/**
 * Jalur 1: got-scraping — bypass Cloudflare TLS fingerprinting
 */
async function fetchViaGotScraping(post: string, nume: string, type: string): Promise<string | null> {
  try {
    const { gotScraping } = await import("got-scraping");
    const body = `action=player_ajax&post=${post}&nume=${nume}&type=${type}`;

    const response = await gotScraping({
      method: "POST",
      url: EMBED_URL,
      headers: {
        "User-Agent": USER_AGENT,
        "X-Requested-With": "XMLHttpRequest",
        Referer: REFERER,
        Origin: REFERER.replace(/\/$/, ""),
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body,
      timeout: { request: 10000 },
    });

    if (response.statusCode === 200 && response.body) {
      console.log("[Embed] got-scraping: SUCCESS");
      return response.body;
    }
    console.warn(`[Embed] got-scraping: HTTP ${response.statusCode}`);
    return null;
  } catch (err: any) {
    console.warn(`[Embed] got-scraping failed: ${err.message}`);
    return null;
  }
}

/**
 * Jalur 2: curl via child_process — bypass Cloudflare di local/Ubuntu
 */
async function fetchViaCurl(post: string, nume: string, type: string): Promise<string | null> {
  try {
    const body = `action=player_ajax&post=${post}&nume=${nume}&type=${type}`;
    const command = `curl -s -X POST "${EMBED_URL}" \
      -H "User-Agent: ${USER_AGENT}" \
      -H "X-Requested-With: XMLHttpRequest" \
      -H "Referer: ${REFERER}" \
      -H "Origin: ${REFERER.replace(/\/$/, "")}" \
      -H "Content-Type: application/x-www-form-urlencoded; charset=UTF-8" \
      --data-raw "${body}" \
      --max-time 10`;

    const { stdout } = await execAsync(command, { timeout: 12000 });
    if (stdout && stdout.includes("iframe")) {
      console.log("[Embed] curl: SUCCESS");
      return stdout;
    }
    console.warn("[Embed] curl: no iframe in response");
    return null;
  } catch (err: any) {
    console.warn(`[Embed] curl failed: ${err.message}`);
    return null;
  }
}

/**
 * Jalur 3: native fetch — fallback terakhir
 */
async function fetchViaNative(post: string, nume: string, type: string): Promise<string | null> {
  try {
    const body = `action=player_ajax&post=${post}&nume=${nume}&type=${type}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(EMBED_URL, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "X-Requested-With": "XMLHttpRequest",
        Referer: REFERER,
        Origin: REFERER.replace(/\/$/, ""),
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body,
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);

    if (response.ok) {
      const html = await response.text();
      if (html && html.includes("iframe")) {
        console.log("[Embed] native fetch: SUCCESS");
        return html;
      }
    }
    console.warn(`[Embed] native fetch: HTTP ${response.status}`);
    return null;
  } catch (err: any) {
    console.warn(`[Embed] native fetch failed: ${err.message}`);
    return null;
  }
}

/**
 * Extract iframe URL dari HTML response
 */
function extractIframeUrl(html: string): string {
  const $ = cheerio.load(html);

  let iframeUrl =
    $("iframe").attr("src") ||
    $("iframe").attr("data-src") ||
    $("iframe").attr("data-lazy-src") ||
    "";

  // Regex fallback
  if (!iframeUrl) {
    const match = html.match(/src=["']([^"']+)["']/i);
    if (match && match[1] && !match[1].includes("cloudflare.com")) {
      iframeUrl = match[1];
    }
  }

  // Sanitize
  if (iframeUrl) {
    iframeUrl = iframeUrl.replace(/\\/g, "").trim().replace(/[;,]+$/, "");
    if (iframeUrl.startsWith("//")) {
      iframeUrl = "https:" + iframeUrl;
    }
  }

  return iframeUrl;
}

/**
 * Error page HTML template
 */
function errorPage(message: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
    <html>
      <body style="background:#09090b;color:#a1a1aa;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;font-size:13px;">
        <div style="text-align:center;">
          <p style="margin-bottom:8px;font-weight:600;color:#f4f4f5;">${message}</p>
          <p style="font-size:12px;color:#71717a;">Silakan coba pilih server lain di bawah player.</p>
        </div>
      </body>
    </html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const post = searchParams.get("post");
    const nume = searchParams.get("nume");
    const type = searchParams.get("type") || "schtml";
    const format = searchParams.get("format");

    if (!post || !nume) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    console.log(`[Embed] Fetching: post=${post}, nume=${nume}, type=${type}`);

    // 3 jalur: got-scraping → curl → native fetch
    let html: string | null = null;

    html = await fetchViaGotScraping(post, nume, type);
    if (!html) html = await fetchViaCurl(post, nume, type);
    if (!html) html = await fetchViaNative(post, nume, type);

    if (!html) {
      console.error("[Embed] ALL fetch methods failed");
      if (format !== "json") {
        return errorPage("Server streaming sedang tidak dapat diakses.");
      }
      return NextResponse.json({ error: "All fetch methods failed" }, { status: 502 });
    }

    const iframeUrl = extractIframeUrl(html);
    console.log(`[Embed] Final URL: ${iframeUrl || "(empty)"}`);

    // JSON response
    if (format === "json") {
      return NextResponse.json({ iframeUrl });
    }

    // Redirect to iframe URL
    if (iframeUrl) {
      return NextResponse.redirect(iframeUrl, { status: 302 });
    }

    return errorPage("Server streaming sedang tidak dapat diakses.");
  } catch (error: any) {
    console.error("[Embed] Unhandled error:", error.message);
    if (req.nextUrl.searchParams.get("format") !== "json") {
      return errorPage("Gagal menghubungkan ke server pemutar video.");
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
