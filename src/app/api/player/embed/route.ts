export const dynamic = "force-dynamic";
export const revalidate = 300;

import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const EMBED_URL = "https://v2.samehadaku.how/wp-admin/admin-ajax.php";
const REFERER = "https://v2.samehadaku.how/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** Whitelist of allowed redirect domains for iframe URLs */
const ALLOWED_IFRAME_HOSTS = [
  "samehadaku.how",
  "v2.samehadaku.how",
  "wsrv.nl",
  "aniwave.to",
  "mavishub.com",
  "embedsito.com",
  "aniwatch.to",
  "megacloud.club",
  "vidcloud.pro",
  "sbplay.me",
  "embtaku.pro",
  "plyhd.link",
  "metagets.net",
  "asianload.cc",
  "tenshi.id",
  // Streaming server domains seen in episode pages
  "blogspot.com",
  "wibufile.com",
  "mega.nz",
  "blogger.com",
];

function isAllowedIframeHost(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return ALLOWED_IFRAME_HOSTS.some(
      (h) => u.hostname === h || u.hostname.endsWith("." + h),
    );
  } catch {
    return false;
  }
}

/**
 * Jalur 1: got-scraping — bypass Cloudflare TLS fingerprinting
 */
async function fetchViaGotScraping(
  post: string,
  nume: string,
  type: string,
): Promise<string | null> {
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
 * Jalur 2: native fetch — fallback (no execAsync/curl — security fix)
 */
async function fetchViaNative(
  post: string,
  nume: string,
  type: string,
): Promise<string | null> {
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

/** Sanitize message for safe HTML injection */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Error page HTML template — messages are escaped to prevent XSS
 */
function errorPage(message: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
    <html>
      <body style="background:#09090b;color:#a1a1aa;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;font-size:13px;">
        <div style="text-align:center;">
          <p style="margin-bottom:8px;font-weight:600;color:#f4f4f5;">${escapeHtml(message)}</p>
          <p style="font-size:12px;color:#71717a;">Silakan coba pilih server lain di bawah player.</p>
        </div>
      </body>
    </html>`,
    { headers: { "Content-Type": "text/html" } },
  );
}

export async function GET(req: NextRequest) {
  try {
    // Rate limit: 30 requests per minute per IP (stricter for embed)
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(`embed:${ip}`, 30, 60_000);

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 },
      );
    }

    const { searchParams } = req.nextUrl;
    const post = searchParams.get("post");
    const nume = searchParams.get("nume");
    const type = searchParams.get("type") || "schtml";
    const format = searchParams.get("format");

    if (!post || !nume) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    console.log(`[Embed] Fetching: post=${post}, nume=${nume}, type=${type}`);

    // 2 jalur: got-scraping → native fetch (curl removed for security)
    let html: string | null = null;

    html = await fetchViaGotScraping(post, nume, type);
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

    // Redirect to iframe URL — WHITELIST CHECK
    if (iframeUrl) {
      if (!isAllowedIframeHost(iframeUrl)) {
        console.warn(`[Embed] Blocked redirect to disallowed host: ${iframeUrl}`);
        return errorPage("Server streaming sedang tidak dapat diakses.");
      }
      return NextResponse.redirect(iframeUrl, { status: 302 });
    }

    return errorPage("Server streaming sedang tidak dapat diakses.");
  } catch (error) {
    console.error("[Embed] Unhandled error:", error);
    if (req.nextUrl.searchParams.get("format") !== "json") {
      return errorPage("Gagal menghubungkan ke server pemutar video.");
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
