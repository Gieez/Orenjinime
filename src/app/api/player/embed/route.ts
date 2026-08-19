export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { execSync } from 'child_process';

// Helper Fetch menggunakan native cURL OS untuk menembus Cloudflare
function fetchWithCurl(post: string, nume: string, type: string): string {
  const url = 'https://v2.samehadaku.how/wp-admin/admin-ajax.php';
  const body = `action=player_ajax&post=${post}&nume=${nume}&type=${type}`;
  
  const command = `curl -s -X POST "${url}" \
    -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" \
    -H "X-Requested-With: XMLHttpRequest" \
    -H "Referer: https://v2.samehadaku.how/" \
    -H "Origin: https://v2.samehadaku.how/" \
    -H "Content-Type: application/x-www-form-urlencoded; charset=UTF-8" \
    --data-raw "${body}"`;

  return execSync(command, { encoding: 'utf-8', timeout: 10000 });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const post = searchParams.get('post');
    const nume = searchParams.get('nume');
    const type = searchParams.get('type') || 'schtml';
    const format = searchParams.get('format');

    if (!post || !nume) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Ambil HTML dari Samehadaku menggunakan cURL
    const html = fetchWithCurl(post, nume, type);

    console.log(`\n[cURL Bypass Success] Post: ${post}, Nume: ${nume}`);
    console.log(`> Sample: "${html.substring(0, 120).replace(/\s+/g, ' ')}"`);

    const $ = cheerio.load(html);

    // 1. Ekstraksi iframe dari HTML
    let iframeUrl =
      $('iframe').attr('src') ||
      $('iframe').attr('data-src') ||
      $('iframe').attr('data-lazy-src') ||
      '';

    // 2. Regex Fallback jika iframe dibungkus JavaScript
    if (!iframeUrl) {
      const match = html.match(/src=["']([^"']+)["']/i);
      if (match && match[1] && !match[1].includes('cloudflare.com')) {
        iframeUrl = match[1];
      }
    }

    // 3. Sanitasi URL
    if (iframeUrl) {
      iframeUrl = iframeUrl.replace(/\\/g, '').trim().replace(/[;,]+$/, '');
      if (iframeUrl.startsWith('//')) {
        iframeUrl = 'https:' + iframeUrl;
      }
    }

    console.log(`> Final Cleaned URL: "${iframeUrl}"\n`);

    // Respon ke Client
    if (format !== 'json') {
      if (iframeUrl) {
        return NextResponse.redirect(iframeUrl, { status: 302 });
      }

      return new NextResponse(
        `<!DOCTYPE html>
        <html>
          <body style="background:#09090b;color:#a1a1aa;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;font-size:13px;">
            <div style="text-align:center;">
              <p style="margin-bottom:8px;font-weight:600;color:#f4f4f5;">Server streaming sedang tidak dapat diakses.</p>
              <p style="font-size:12px;color:#71717a;">Silakan coba pilih server lain di bawah player.</p>
            </div>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    return NextResponse.json({ iframeUrl });
  } catch (error: any) {
    console.error('[Embed Request Error]:', error.message);
    if (req.nextUrl.searchParams.get('format') !== 'json') {
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
          <body style="background:#09090b;color:#a1a1aa;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;font-size:13px;">
            <p>Gagal menghubungkan ke server pemutar video.</p>
          </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html' } }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}