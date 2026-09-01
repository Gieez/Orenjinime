"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const POPUP_KEY = "orenjinime_welcome_v1";

export function WelcomePopup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(POPUP_KEY);
    if (!dismissed) {
      // Small delay biar ga langsung muncul
      const timer = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(POPUP_KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800/80 text-neutral-400 transition hover:bg-neutral-700 hover:text-white"
          aria-label="Tutup"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>

        {/* Header */}
        <div className="bg-gradient-to-b from-brand/20 to-transparent px-6 pt-8 pb-4 text-center">
          <h2 className="text-2xl font-black text-white tracking-tight">
            Doroo <span className="text-brand">!!</span>
          </h2>
        </div>

        {/* Mascot Image */}
        <div className="flex justify-center px-6">
          <div className="relative h-48 w-48 overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-800">
            <img
              src="/Doro-Orenji.png"
              alt="Doro Orenji Mascot"
              className="h-full w-full object-contain"
            />
          </div>
        </div>

        {/* Message */}
        <div className="px-6 pt-5 pb-6 text-center">
          <p className="text-sm leading-relaxed text-neutral-300">
            Situs web ini dikelola oleh satu orang. Kami berkomitmen untuk menyajikan pengalaman yang bersih, dan aman.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-300">
            Jika Anda ingin berkontribusi untuk biaya server, silakan klik tombol{" "}
            <span className="font-semibold text-brand">&quot;Dukung&quot;</span>.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/dukungan"
              onClick={dismiss}
              className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-dark active:scale-95"
            >
              Dukung
            </Link>
            <button
              onClick={dismiss}
              className="rounded-xl border border-neutral-700 bg-neutral-800 px-5 py-3 text-sm font-medium text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              Mengerti
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
