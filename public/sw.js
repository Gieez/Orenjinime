// public/sw.js

const CACHE_NAME = "nugianime-static-v1";
const STATIC_ASSETS = ["/"];

// 1. Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Gagal pre-cache static assets:", err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// 3. Fetch Event
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isVideo = /\.(m3u8|ts|mp4)$/i.test(url.pathname);
  const isApi = url.pathname.startsWith("/api/"); // 👈 1. Deteksi Route API

  // A. JANGAN CACHE request video, request API, atau method selain GET
  if (isVideo || isApi || event.request.method !== "GET") return;

  // B. JANGAN CACHE navigasi / halaman HTML
  if (event.request.mode === "navigate") return;

  // C. Cache-first HANYA untuk asset statis (gambar, CSS, JS lokal)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          if (res.ok && url.origin === self.location.origin) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});