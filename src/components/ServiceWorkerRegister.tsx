"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        // Registrasi hanya jika sedang di-build untuk production
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // Registrasi gagal — abaikan secara diam-diam
        });
      } else {
        // Saat dev mode, hapus (unregister) Service Worker secara otomatis
        // agar tidak mengacaukan cache Webpack & HMR
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
    }
  }, []);

  return null;
}