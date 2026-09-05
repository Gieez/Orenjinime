import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { AnimeStatus, AnimeType } from "@prisma/client";
import { HttpClient } from "../http-client";
import type {
  SourceAdapter,
  CatalogScrapeResult,
  CatalogItem,
  AnimeDetail,
  EpisodeItem,
  StreamData,
  ScheduleItem,
  NewsItem,
} from "./types";

export interface StreamSourceResult {
  name: string;
  url: string;
  type: string;
  quality?: string;
}

export interface EpisodeDetailResult {
  title: string;
  episodeNumber: number;
  streamSources: StreamSourceResult[];
  nextEpisodeUrl?: string;
  prevEpisodeUrl?: string;
}

export interface Top10Item {
  title: string;
  slug: string;
  url: string;
  poster: string | null;
  rating: number;
  rank: number;
}

const MONTHS: Record<string, number> = {
  januari: 0, january: 0, february: 1, februari: 1, march: 2, maret: 2,
  april: 3, may: 4, mei: 4, june: 5, juni: 5, july: 6, juli: 6,
  august: 7, agustus: 7, september: 8, october: 9, oktober: 9,
  november: 10, december: 11, desember: 11,
};

const DAY_MAP: Record<string, number> = {
  minggu: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, jumaat: 5, sabtu: 6,
};

// Order of days rendered on samehadaku's /jadwal/ page (Senin → Minggu)
const SCHEDULE_DAYS = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu"];

const TYPE_MAP: Record<string, AnimeType> = {
  tv: AnimeType.TV,
  movie: AnimeType.MOVIE,
  ova: AnimeType.OVA,
  ona: AnimeType.ONA,
  special: AnimeType.SPECIAL,
};

function clean(value?: string | null): string | undefined {
  const result = value?.replace(/\s+/g, " ").trim();
  return result || undefined;
}

function parseRating(val?: string | number | null): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const parsed = Number.parseFloat(val.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function absoluteUrl(baseUrl: string, href: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function extractSlug(url: string): string {
  const normalized = url.replace(/\/+$/, "");
  const animeMatch = normalized.match(/\/anime\/([^/]+)$/i);
  if (animeMatch) return animeMatch[1];
  return normalized.split("/").pop() || "";
}

function parseStatus(value?: string | null): AnimeStatus {
  const text = (value ?? "").toLowerCase();
  if (/completed|finished|tamat|selesai/.test(text)) return AnimeStatus.COMPLETED;
  if (/upcoming|akan tayang|belum tayang/.test(text)) return AnimeStatus.UPCOMING;
  return AnimeStatus.ONGOING;
}

function parseType(value?: string | null): AnimeType | null {
  const key = clean(value)?.toLowerCase();
  return key ? TYPE_MAP[key] ?? null : null;
}

function labeledValue($: cheerio.CheerioAPI, label: string): string | undefined {
  let result: string | undefined;
  $(".spe > span").each((_, el) => {
    const key = clean($(el).find("b").first().text())?.replace(/:$/, "").toLowerCase();
    if (key !== label.toLowerCase()) return;
    const clone = $(el).clone();
    clone.find("b").remove();
    result = clean(clone.text());
    return false;
  });
  return result;
}

function parseLabeledLinks($: cheerio.CheerioAPI, label: string): string[] {
  const values: string[] = [];
  $(".spe > span").each((_, el) => {
    const key = clean($(el).find("b").first().text())?.replace(/:$/, "").toLowerCase();
    if (key !== label.toLowerCase()) return;
    $(el).find("a").each((_, link) => {
      const value = clean($(link).text());
      if (value && !values.includes(value)) values.push(value);
    });
    if (values.length === 0) {
      const clone = $(el).clone();
      clone.find("b").remove();
      const text = clean(clone.text());
      if (text) {
        for (const item of text.split(",")) {
          const value = clean(item);
          if (value && !values.includes(value)) values.push(value);
        }
      }
    }
  });
  return values;
}

function parseCalendarDate(text: string): Date | null {
  const value = clean(text);
  if (!value) return null;

  const match = value.match(/(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})/i);
  if (match) {
    const month = MONTHS[match[2].toLowerCase()];
    if (month !== undefined) {
      const date = new Date(Date.UTC(Number(match[3]), month, Number(match[1])));
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseRelativeDate(text: string, now = new Date()): Date | null {
  const value = clean(text)?.toLowerCase();
  if (!value) return null;

  if (value === "kemarin" || value.includes("yesterday")) {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  const match = value.match(/(\d+(?:[.,]\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|menit|j|jam|h|hour|hours|d|day|days|hari)\b/);
  if (!match) return parseCalendarDate(value);

  const amount = Number(match[1].replace(",", "."));
  const unit = match[2];

  let ms = 0;
  if (/^(s|sec|secs|second|seconds)$/.test(unit)) ms = amount * 1000;
  else if (/^(m|min|mins|minute|minutes|menit)$/.test(unit)) ms = amount * 60 * 1000;
  else if (/^(j|jam|h|hour|hours)$/.test(unit)) ms = amount * 60 * 60 * 1000;
  else if (/^(d|day|days|hari)$/.test(unit)) ms = amount * 24 * 60 * 60 * 1000;

  return ms > 0 ? new Date(now.getTime() - ms) : null;
}

function cleanSynopsis(text?: string | null): string | undefined {
  if (!text) return undefined;
  return text
    .replace(/\bsamehadaku\b/gi, "OrenJiNime")
    .replace(/\bsamehadaku\.how\b/gi, "OrenJiNime")
    .replace(/\bv2\.samehadaku\.how\b/gi, "OrenJiNime")
    .trim() || undefined;
}

function parseEpisodeNumber(text: string, href?: string): number | undefined {
  const explicit = text.match(/(?:episode|eps|ep)\s*(\d+(?:\.\d+)?)/i);
  if (explicit) return Number(explicit[1]);

  const fromHrefExplicit = href?.match(/(?:episode|eps|ep)[-_]?([0-9]+(?:\.[0-9]+)?)/i);
  if (fromHrefExplicit) return Number(fromHrefExplicit[1]);

  if (href) {
    const hrefNumberMatch = href.match(/[-_](\d+(?:\.\d+)?)(?:[-_]sub|[-_]indo|[-_]caption|\/|$)/i);
    if (hrefNumberMatch) return Number(hrefNumberMatch[1]);
  }

  const standalone = text.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s|$)/);
  return standalone ? Number(standalone[1]) : undefined;
}

export class NugiAnimeAdapter implements SourceAdapter {
  public readonly baseUrl: string;

  constructor(baseUrl = "https://v2.samehadaku.how/") {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  public async fetchLatestAnimeList(pageUrl: string): Promise<CatalogItem[]> {
    try {
      const html = await HttpClient.getHtml(pageUrl);
      return (await this.scrapeCatalog(html)).items;
    } catch (error) {
      console.error(`[SCRAPER] Gagal mengambil katalog: ${pageUrl}`, error);
      return [];
    }
  }

  public parseHomepage(html: string): CatalogItem[] {
    const $ = cheerio.load(html);
    const items: CatalogItem[] = [];

    const $cards = $(".justpost .post-show ul li, .post-show ul li").not(".widget_senishi_topten li");

    $cards.each((i, el) => {
      const $el = $(el);
      const title = clean($el.find("h2.entry-title a, .title a, .entry-title").first().text()) || "";
      const url = $el.find("h2.entry-title a, .thumb a, a").first().attr("href") || "";
      
      let slug = "";
      if (url) {
        const urlParts = url.replace(/\/+$/, "").split("/");
        slug = urlParts[urlParts.length - 1];
      }

      const poster = clean(
        $el.find(".thumb img").attr("src") || 
        $el.find(".thumb img").attr("data-src")
      ) || null;

      const episodeNum = clean($el.find("span author, .eps, .epx").first().text());

      if (title && slug) {
        items.push({
          title,
          slug,
          sourceUrl: absoluteUrl(this.baseUrl, url),
          poster,
          status: parseStatus(episodeNum),
          type: AnimeType.TV,
          rating: null,
          latestOrder: i + 1,  // <-- ADD: urutan di homepage (1 = hero, 2 = latest ep 2, dst)
        });
      }
    });

    return items;
  }

  public async scrapeCatalog(html: string): Promise<CatalogScrapeResult> {
    const $ = cheerio.load(html);
    const items: CatalogItem[] = [];

    // Targetkan strictly container Latest Episode Samehadaku
    const $cards = $(".justpost .post-show ul li, .post-show ul li").not(".widget_senishi_topten li");

    $cards.each((_, el) => {
      const $el = $(el);

      const title = clean($el.find("h2.entry-title a, .title a, .entry-title").first().text()) || "";
      const url = $el.find("h2.entry-title a, .thumb a, a").first().attr("href") || "";
      
      let slug = "";
      if (url) {
        const urlParts = url.replace(/\/+$/, "").split("/");
        slug = urlParts[urlParts.length - 1];
      }

      const poster = clean(
        $el.find(".thumb img").attr("src") || 
        $el.find(".thumb img").attr("data-src")
      ) || null;

      const episodeNum = clean($el.find("span author, .eps, .epx").first().text());

      if (title && slug) {
        items.push({
          title,
          slug,
          sourceUrl: absoluteUrl(this.baseUrl, url),
          poster,
          status: parseStatus(episodeNum),
          type: AnimeType.TV,
          rating: null,
        });
      }
    });

    return { items, hasNextPage: items.length > 0 };
  }

  // --- FITUR BARU: PARSE PENCARIAN (LIVE SEARCH) ---
  public parseSearch(html: string): CatalogItem[] {
    const $ = cheerio.load(html);
    const items: CatalogItem[] = [];

    // SAPU BERSIH TOTAL: Ambil SEMUA tag <a> yang URL-nya mengandung '/anime/'
    $("a[href*='/anime/']").each((_, el) => {
      const $a = $(el);
      const href = $a.attr("href");
      if (!href) return;

      const url = absoluteUrl(this.baseUrl, href);
      const slug = extractSlug(url);

      // Validasi slug agar benar-benar halaman detail anime
      if (!slug || slug === "anime" || slug.includes("?s=") || slug.includes("page") || slug.includes("tag") || slug.includes("genre")) {
        return;
      }

      // Cari elemen pembungkus terdekat untuk mengambil gambar poster/judul jika ada
      const $parent = $a.closest("article, li, div.animpost, div.animposx, div.post-show");

      // Ambil Judul dari teks link, atribut title, atau heading di dalam parent
      const title = clean(
        $parent.find("h2, .title, .entry-title, .info .title").first().text() ||
        $a.attr("title") ||
        $a.text()
      );

      if (!title || title.length < 2) return;

      // Ambil Poster dari gambar terdekat
    // Ambil Poster dari gambar terdekat
    const img = $parent.find("img").first().length ? $parent.find("img").first() : $a.find("img").first();

    // URUTAN SANGAT PENTING: Cek data-lazy-src dan data-src DULU sebelum src
    const poster = clean(
      img.attr("data-lazy-src") || 
      img.attr("data-src") || 
      img.attr("src") || 
      img.attr("srcset")?.split(" ")[0]
    ) || "https://via.placeholder.com/200x300?text=No+Image"; // Beri default image jika gagal
      // Ambil Rating jika ada
      const ratingText = clean($parent.find(".score, .rating, .upscore").text());

      items.push({
        title: title.replace(/^Nonton Anime\s+/i, "").trim(),
        slug,
        sourceUrl: url,
        poster,
        status: AnimeStatus.ONGOING,
        type: AnimeType.TV,
        rating: parseRating(ratingText),
      });
    });

    // Unikkan berdasarkan slug agar tidak ada data ganda
    return Array.from(new Map(items.map(item => [item.slug, item])).values());
  }

  public parseAnimeDetail(html: string, sourceUrl: string): AnimeDetail {
    const $ = cheerio.load(html);
    const slug = extractSlug(sourceUrl);

    let title = clean(
      $(".infoanime h2.entry-title[itemprop='name'], .infoanime .entry-title[itemprop='name'], h1.entry-title").first().text()
    );
    title = title?.replace(/^Nonton Anime\s+/i, "").trim();

    const poster = clean(
      $(".infoanime .thumb img[itemprop='image'], .infoanime .thumb img, .poster img").first().attr("src") ||
        $(".infoanime .thumb img, .poster img").first().attr("data-src")
    );

    const synopsis = cleanSynopsis(
      $(".entry-content-single[itemprop='description'], .infoanime .desc, .synopsis").first().text()
    );

    const englishTitle = labeledValue($, "English");
    const japaneseTitle = labeledValue($, "Japanese");
    const alternativeTitle = englishTitle || japaneseTitle || null;

    const status = parseStatus(labeledValue($, "Status"));
    const type = parseType(labeledValue($, "Type"));
    const studio = labeledValue($, "Studio") || null;
    const rating = parseRating(
      $(".archiveanime-rating [itemprop='ratingValue'], .rating, .score, .numscore, .upscore").first().text()
    );

    const genres: string[] = [];
    $(".genre-info a[itemprop='genre'], .genre-info a").each((_, el) => {
      const value = clean($(el).text());
      if (value && !genres.includes(value)) genres.push(value);
    });

    const producers = parseLabeledLinks($, "Producers");
    const released = labeledValue($, "Released");
    const season = labeledValue($, "Season");
    const yearMatch = `${released ?? ""} ${season ?? ""}`.match(/\b(19|20)\d{2}\b/);

    return {
      title: title || slug,
      slug,
      alternativeTitle,
      synopsis,
      poster,
      banner: null,
      status,
      type,
      year: yearMatch ? Number(yearMatch[0]) : null,
      studio,
      rating,
      popularity: 0,
      sourceUrl,
      genres,
      producers,
    };
  }

  private parseEpisodeListInternal(html: string): EpisodeItem[] {
    const $ = cheerio.load(html);
    const episodes: EpisodeItem[] = [];
    const seen = new Set<number>();
    const scrapedAt = new Date();

    const selectors = [
      ".lstepsiode.listeps li",
      ".lstepside.listeps li",
      ".lastep ul li",
      ".lastep li",
      ".eplister ul li",
      ".epsbox ul li",
      ".episodelist ul li",
      ".widget-series ul li",
      ".listep ul li",
      ".listeps ul li",
      ".series-chapter li",
      ".list-episode ul li",
      "#chapterlist li",
      ".lstrip ul li",
      ".lrb ul li",
    ].join(", ");

    const matchedElements = $(selectors);

    matchedElements.each((_, el) => {
      const row = $(el);
      const linkEl = row.find("a[href]").first();
      const href = linkEl.attr("href");

      if (!href) return;

      const sourceUrl = absoluteUrl(this.baseUrl, href);
      const title =
        clean(row.find(".lchx a, .eps a, .epl-title, .titleall, .title").first().text()) ||
        clean(linkEl.text()) ||
        clean(row.text());

      const episodeNumber = parseEpisodeNumber(title || "", sourceUrl);

      if (
        episodeNumber === undefined ||
        Number.isNaN(episodeNumber) ||
        seen.has(episodeNumber)
      ) {
        return;
      }

      const dateText = clean(row.find(".date, .epl-date, .epsleft .date").first().text());
      const releasedAt = dateText ? parseRelativeDate(dateText, scrapedAt) : null;

      seen.add(episodeNumber);
      episodes.push({
        episodeNumber,
        title: title || `Episode ${episodeNumber}`,
        sourceUrl,
        releasedAt,
      });
    });

    if (episodes.length === 0) {
      const canonicalUrl =
        $('link[rel="canonical"]').attr("href") ||
        $('meta[property="og:url"]').attr("content") ||
        "";

      if (canonicalUrl) {
        episodes.push({
          episodeNumber: 1,
          title: "Full Movie / OVA",
          sourceUrl: absoluteUrl(this.baseUrl, canonicalUrl),
          releasedAt: scrapedAt,
        });
      }
    }

    episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
    return episodes;
  }

  public parseEpisodeList(html: string, _animeSlug?: string): EpisodeItem[] {
    return this.parseEpisodeListInternal(html);
  }

  public parseTop10(html: string): Top10Item[] {
    const $ = cheerio.load(html);
    const top10List: Top10Item[] = [];

    const $items = $(".topten-animesu ul li, .widgetseries ul li");

    $items.each((idx, el) => {
      const $el = $(el);
      const $a = $el.find("a.series, a").first();
      const href = $a.attr("href") || "";

      if (!href) return;

      const url = absoluteUrl(this.baseUrl, href);
      const slug = extractSlug(url);
      const title = clean($el.find(".judul").text() || $a.attr("title")) || "";

      const $img = $el.find("img").first();
      const poster = clean($img.attr("src") || $img.attr("data-src")) || null;
      
      const ratingText = $el.find(".rating").text().replace(/[^0-9.]/g, "");
      const rating = parseFloat(ratingText) || 0;

      const rankText = $el.find(".is-topten").text().replace(/[^0-9]/g, "");
      const rank = parseInt(rankText, 10) || idx + 1;

      if (slug && title) {
        top10List.push({
          title,
          slug,
          url,
          poster,
          rating,
          rank,
        });
      }
    });

    return top10List.sort((a, b) => a.rank - b.rank).slice(0, 10);
  }

  public parseStreamSources(html: string, resolveProxy: boolean = false): StreamSourceResult[] {
    const $ = cheerio.load(html);
    const sources: StreamSourceResult[] = [];

    $(".east_player_option, [class*='player-option']").each((_, el) => {
      const $el = $(el);
      const name = clean($el.text());
      const post = $el.attr("data-post");
      const nume = $el.attr("data-nume");
      const type = $el.attr("data-type") || "schtml";

      if (!post || !nume || !name) return;

      let quality = "HD";
      if (/480p/i.test(name)) quality = "480p";
      else if (/720p/i.test(name)) quality = "720p";
      else if (/1080p/i.test(name)) quality = "1080p";

      // When resolveProxy=false (default, used by /api/player/embed runtime),
      // keep the proxy URL so the request resolves samehadaku fresh each time
      // (Vercel -> samehadaku; usually blocked by Cloudflare but works locally).
      // When resolveProxy=true (sync time, runs in local scraper),
      // resolve to the direct iframe URL by hitting the samehadaku AJAX endpoint
      // and store the resolved URL in DB. At runtime the iframe just loads the
      // direct streaming host (wibufile/mega/blogspot) — no Vercel proxy needed.
      const proxyUrl = `/api/player/embed?post=${encodeURIComponent(post)}&nume=${encodeURIComponent(nume)}&type=${encodeURIComponent(type)}`;
      if (!sources.some((source) => source.url === proxyUrl)) {
        sources.push({ name, url: proxyUrl, type: "embed", quality });
      }
    });

    if (sources.length === 0) {
      $("#player_embed iframe, #embed_holder iframe, iframe").each((_, el) => {
        let src = $(el).attr("src") || $(el).attr("data-src") || "";
        if (!src || /facebook|twitter|disqus|ads/i.test(src)) return;
        if (src.startsWith("//")) src = `https:${src}`;
        if (!sources.some((source) => source.url === src)) {
          sources.push({
            name: "Server Utama",
            url: src,
            type: "embed",
            quality: "HD",
          });
        }
      });
    }

    return sources;
  }

  /**
   * Resolve proxy stream URLs to their direct iframe URL by hitting the
   * samehadaku admin-ajax endpoint. Used only at sync time (local scraper)
   * so the stored DB URLs can be loaded directly by the browser without
   * going through /api/player/embed (which gets blocked by Cloudflare when
   * called from Vercel's serverless IP range).
   *
   * Returns a map from proxy URL → resolved direct URL. If resolution fails
   * for a given proxy, that entry is omitted (caller should keep proxy).
   */
  public async resolveStreamUrls(proxyUrls: string[]): Promise<Map<string, string>> {
    const resolved = new Map<string, string>();
    for (const proxyUrl of proxyUrls) {
      try {
        const m = proxyUrl.match(/post=([^&]+)&nume=([^&]+)&type=([^&]+)/);
        if (!m) continue;
        const [, post, nume, type] = m;
        const html = await this.fetchPlayerAjax(decodeURIComponent(post), decodeURIComponent(nume), decodeURIComponent(type));
        if (!html) continue;
        const direct = this.extractDirectIframeUrl(html);
        if (direct) {
          resolved.set(proxyUrl, direct);
        }
      } catch {
        // skip — keep proxy
      }
      // Light throttle to avoid hammering samehadaku
      await new Promise((r) => setTimeout(r, 800));
    }
    return resolved;
  }

  private async fetchPlayerAjax(post: string, nume: string, type: string): Promise<string | null> {
    const EMBED_URL = `${this.baseUrl}/wp-admin/admin-ajax.php`;
    const REFERER = `${this.baseUrl}/`;
    const UA =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
    try {
      const { gotScraping } = await import("got-scraping");
      const res = await gotScraping({
        method: "POST",
        url: EMBED_URL,
        headers: {
          "User-Agent": UA,
          "X-Requested-With": "XMLHttpRequest",
          Referer: REFERER,
          Origin: this.baseUrl,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body: `action=player_ajax&post=${post}&nume=${nume}&type=${type}`,
        timeout: { request: 10000 },
      });
      if (res.statusCode === 200 && res.body) return res.body;
    } catch {
      // fall through
    }
    return null;
  }

  private extractDirectIframeUrl(html: string): string | null {
    const $ = (require("cheerio") as typeof import("cheerio")).load(html);
    let url = $("iframe").attr("src") || $("iframe").attr("data-src") || $("iframe").attr("data-lazy-src") || "";
    if (!url) {
      const m = html.match(/src=["']([^"']+)["']/i);
      if (m && m[1] && !m[1].includes("cloudflare.com")) url = m[1];
    }
    if (!url) return null;
    url = url.replace(/\\/g, "").trim().replace(/[;,]+$/, "");
    if (url.startsWith("//")) url = "https:" + url;
    return url;
  }

  public async getAnimeDetails(html: string, sourceUrl: string): Promise<AnimeDetail> {
    return this.parseAnimeDetail(html, sourceUrl);
  }

  public async getEpisodesList(html: string): Promise<EpisodeItem[]> {
    return this.parseEpisodeListInternal(html);
  }

  public async getSchedule(html: string, day?: string): Promise<ScheduleItem[]> {
    // Samehadaku's /jadwal/ page renders all 7 days in a single response
    // — each .result-schedule block corresponds to a day in tab order:
    //   Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu
    // (the .on class marks today's active tab, but the HTML contains all).
    const $ = cheerio.load(html);
    const results: ScheduleItem[] = [];

    // Always iterate all 7 result-schedule blocks in order
    $(".result-schedule").each((index, el) => {
      const dayOfWeek = SCHEDULE_DAYS[index];
      if (!dayOfWeek) return;
      // If caller filtered to a specific day, skip others
      if (day && day !== dayOfWeek) return;

      $(el).find(".animepost").each((_, card) => {
        const $card = $(card);
        const href = $card.find(".animposx > a[href], a[href]").first().attr("href");
        if (!href) return;

        const sourceUrl = absoluteUrl(this.baseUrl, href);
        const slug = extractSlug(sourceUrl);
        const airTime = clean($card.find(".data_tw .ltseps, .ltseps").first().text());
        if (!slug || !airTime) return;

        const key = `${slug}|${dayOfWeek}|${airTime}`;
        if (results.some((item) => `${item.animeSlug}|${item.dayOfWeek}|${item.airTime}` === key)) return;

        results.push({
          animeSlug: slug,
          animeSourceUrl: sourceUrl,
          airTime,
          dayOfWeek,
        });
      });
    });

    return results;
  }

  /**
   * Schedule page URL — samehadaku renders all 7 days in a single
   * /jadwal/ response (day parameter is only used to filter the result
   * set on the parser side).
   */
  public scheduleUrl(_day: string): string {
    return `${this.baseUrl}/jadwal/`;
  }

  public async getEpisodeStreams(html: string): Promise<StreamData> {
    const $ = cheerio.load(html);
    const streams = this.parseStreamSources(html).map((source) => ({
      name: source.name,
      url: source.url,
      type: source.type,
      quality: source.quality,
    }));

    const previousUrl = $(".naveps .nvs:first-child a[href]").attr("href") || null;
    const allEpisodesUrl = $(".naveps .nvsc a[href]").attr("href") || null;
    const nextHref = $(".naveps .rght a[href]").attr("href") || null;
    const nextUrl = nextHref && nextHref !== "#" && !$(".naveps .rght a").hasClass("nonex") ? nextHref : null;

    return {
      streams,
      navigation: {
        previousUrl,
        allEpisodesUrl,
        nextUrl,
      },
    };
  }

  public async scrapeNews(html: string): Promise<NewsItem[]> {
    const $ = cheerio.load(html);
    const news: NewsItem[] = [];

    $(".news-item, .post-news, article").each((_, el) => {
      const title = clean($(el).find("h2, h3, .title").first().text());
      const link = $(el).find("a[href]").first().attr("href") || "";
      if (!title || !link) return;

      const sourceUrl = absoluteUrl(this.baseUrl, link);
      const slug = extractSlug(sourceUrl);
      const thumbnail = clean($(el).find("img").first().attr("src"));
      const synopsis = clean($(el).find(".excerpt, .desc, p").first().text());

      news.push({
        title,
        slug,
        synopsis: synopsis || null,
        thumbnail: thumbnail || null,
        sourceUrl,
      });
    });

    return news;
  }

  public parseEpisodePage(html: string): EpisodeDetailResult {
    const $ = cheerio.load(html);
    const title = clean(
      $("h1.entry-title, .episode-title, header h1, .animetitle-episode").first().text()
    ) || "Episode";
    const episodeNumber = parseEpisodeNumber(title) || 1;
    const streamSources = this.parseStreamSources(html);
    const prevEpisodeUrl = $(".naveps .nvs:first-child a[href]").attr("href");
    const nextHref = $(".naveps .rght a[href]").attr("href");
    const nextEpisodeUrl = nextHref && nextHref !== "#" && !$(".naveps .rght a").hasClass("nonex") ? nextHref : undefined;

    return {
      title,
      episodeNumber,
      streamSources,
      nextEpisodeUrl,
      prevEpisodeUrl,
    };
  }
}