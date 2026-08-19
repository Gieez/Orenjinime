import { chromium } from "playwright";

export class HttpClient {
  static async getHtml(url: string): Promise<string> {
    const safeUrl = url
      .replace(/^https?:\/\/?https?:\/\//i, "https://")
      .replace(/^https?:\/\/https\/\//i, "https://");

    const bravePath = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";

    const browser = await chromium.launch({ 
      executablePath: bravePath,
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,720'
      ]
    }).catch(async () => {
      return await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
      });
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'id-ID',
    });

    await context.addInitScript("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})");

    const page = await context.newPage();

    try {
      await page.goto(safeUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 45000 
      });

      const pageTitle = await page.title();
      console.log(`[PLAYWRIGHT DEBUG] Judul Halaman yang Terbuka: "${pageTitle}"`);

      // DITAMBAHKAN: Selector .animpost... (kode kamu sebelumnya)
      await page.waitForFunction(
        () => 
          document.querySelector('.post-show') || 
          document.querySelector('.animpost') || 
          document.querySelector('.animposx') || 
          document.querySelector('article') || 
          document.querySelector('.animepost') ||
          document.querySelector('.live-search'), 
        { timeout: 10000 }
      ).catch(() => {});

      // TAMBAHKAN INI: Scroll sedikit untuk trigger lazy-load di DOM
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(500); // Tunggu setengah detik setelah scroll

      const html = await page.content();
      await browser.close();
      return html;

    } catch (error) {
      await browser.close();
      throw error;
    }
  }
}