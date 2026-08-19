
## NugiAnime scraper adapter

The scraper now uses `src/scraper/adapters/nuginime-adapter.ts`, based on the
NugiAnime HTML structure supplied for catalog, anime detail, episode list, and
schedule pages.

It stores anime metadata, genres, episode page URLs, release dates, and
schedule entries. Streaming iframe/media extraction is intentionally not part
of this adapter; `StreamSource` remains available for a separate, authorized
streaming integration.

Set `SOURCE_BASE_URL=https://nuginime.com` in `.env`.
If the schedule page URL differs from `/jadwal-rilis/`, set `SCHEDULE_URL` to
the actual schedule page.

# NugiAnime

Proyek kampus: web streaming anime full-stack dengan alur

```
Sumber (mengizinkan scraping) → Scraper/Crawler → Cleaning & Parsing → PostgreSQL → Next.js API → Frontend
```

## Yang sudah dibuat (tahap 1–13 dari roadmap)

- ✅ Setup Next.js + TypeScript + Tailwind
- ✅ Prisma schema (Anime, Episode, Genre, Schedule, News, StreamSource, Subtitle, FailedUrl)
- ✅ Scraper modular dengan **adapter pattern** — lihat `src/scraper/adapters/types.ts` dan `example-adapter.ts`
- ✅ Catalog crawler dengan pagination otomatis, dedup, concurrency limit, retry + exponential backoff
- ✅ Incremental scraping (upsert berbasis `sourceUrl` + `contentHash`, `lastScrapedAt`)
- ✅ Failed URL tracking (`FailedUrl` table)
- ✅ Scheduler terpisah (`src/scheduler/index.ts`) pakai `node-cron`, tidak full re-scrape
- ✅ API Route Handlers: anime, search, genres, schedule, news, recommendations, streams
- ✅ Frontend: homepage, `/anime`, `/anime/[slug]`, `/watch/[anime]/[episode]`, `/search`, `/genres/[slug]`, `/schedule`, `/news`
- ✅ Video player (HLS.js) dengan resume playback (localStorage), skip intro, multi-server, subtitle
- ✅ Dark mode default
- ✅ PWA dasar (manifest + service worker, **tidak** cache file video)

## Yang PERLU kamu lengkapi sendiri

1. **Adapter sumber asli.** File `src/scraper/adapters/example-adapter.ts` berisi selector placeholder
   (`.anime-item`, `.detail-title`, dst). Ganti dengan selector nyata sesuai HTML sumber yang kamu
   pakai — dan **pastikan sumber tersebut memang mengizinkan scraping** (cek robots.txt & ToS-nya).
   Kamu tidak perlu mengubah file lain di luar folder `adapters/`.
2. **Integrasi Streaming API kamu sendiri.** Endpoint `GET /api/anime/[slug]/episodes/[episode]/streams`
   membaca dari tabel `StreamSource`/`Subtitle`. Kamu perlu menulis job/endpoint tambahan yang mengambil
   data dari Streaming API-mu dan menyimpannya ke dua tabel itu (bukan scraping video).
3. **Icon PWA** (`public/icons/icon-192.png`, `icon-512.png`) — belum disertakan.

## Menjalankan secara lokal

```bash
npm install
cp .env.example .env   # isi DATABASE_URL, dst
npm run db:migrate      # bikin tabel di Postgres
npm run dev              # jalankan Next.js di http://localhost:3000
```

Isi data awal (jalankan scraper katalog):

```bash
npm run scrape:catalog
npm run scrape:schedule
npm run scrape:news
```

Jalankan scheduler (opsional, untuk update berkala tanpa cron eksternal):

```bash
npm run scheduler
```

## Struktur folder penting

```
src/
├── app/            → halaman & API route handlers (Next.js App Router)
├── components/      → AnimeCard, VideoPlayer, dll
├── lib/              → prisma client, zod validation, slug helper
├── scraper/
│   ├── adapters/    → GANTI DI SINI untuk sumber baru
│   ├── catalog/      → discover + orkestrasi scrape
│   ├── anime/        → detail & episode scraper
│   ├── schedule/, news/
│   └── persist/     → upsert logic (incremental)
└── scheduler/        → cron job terpisah
```

## Roadmap deployment (tahap 24)

- **Frontend + API** → Vercel (`vercel deploy`)
- **Database** → Supabase Postgres atau Neon (isi `DATABASE_URL`)
- **Scraper** → jangan taruh sebagai serverless function biasa (bisa timeout). Pakai:
  - GitHub Actions dengan cron schedule (job ringan/menengah), atau
  - worker terpisah (VPS kecil / Railway / Fly.io) yang menjalankan `npm run scheduler`

## Catatan etika scraping

Scraper ini didesain untuk **tidak**:
- melewati captcha, login wall, atau proteksi anti-bot
- mengabaikan `robots.txt`
- mem-flood server sumber (ada `SCRAPER_DELAY_MS`, `SCRAPER_CONCURRENCY`, timeout, retry terbatas)
- scraping ulang video (video diambil dari Streaming API milikmu sendiri)

Pastikan sumber katalog yang kamu pilih memang mengizinkan scraping untuk data metadata (judul, sinopsis,
genre, jadwal), atau sudah punya API publik yang bisa dipakai sebagai gantinya.
