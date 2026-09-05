import { gotScraping } from "got-scraping";
const urls = [
  "https://v2.samehadaku.how/jadwal/",
  "https://v2.samehadaku.how/jadwal-rilis/",
];
for (const url of urls) {
  const res = await gotScraping({
    url, headers: { "User-Agent": "Mozilla/5.0", Referer: "https://v2.samehadaku.how/" }, timeout: { request: 15000 }
  });
  const html = res.body;
  const $ = await import("cheerio").then(m => m.load(html));
  const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  const slugs = new Set();
  $(".animepost").each((_, el) => {
    const href = $(el).find("a[href]").first().attr("href") || "";
    const m = href.match(/anime\/([^/]+)\//);
    if (m) slugs.add(m[1]);
  });
  console.log(`${url}: ${html.length} chars, ${slugs.size} unique anime slugs`);
  console.log(`  sample slugs: ${[...slugs].slice(0, 3).join(", ")}`);
}
