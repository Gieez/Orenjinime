import { gotScraping } from "got-scraping";
import * as cheerio from "cheerio";

const res = await gotScraping({
  url: "https://v2.samehadaku.how/jadwal/",
  headers: {
    "User-Agent": "Mozilla/5.0",
    Referer: "https://v2.samehadaku.how/",
  },
  timeout: { request: 20000 },
});
const $ = cheerio.load(res.body);

// Print HTML snippet of schedule container
console.log($(".east_days_option, .days-container, .schedule-days, [class*='day']").slice(0, 10).toString().slice(0, 1000));
// Print all IDs and classes related to schedule
$("[id*='schedule'], [class*='schedule']").each((_, el) => {
  console.log("Found schedule el:", $(el).attr("id"), $(el).attr("class"));
});
