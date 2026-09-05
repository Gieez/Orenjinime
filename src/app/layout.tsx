import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { Navbar } from "@/components/Navbar";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { WelcomePopup } from "@/components/WelcomePopup";

export const metadata: Metadata = {
  title: "OrenJiNime — Streaming Anime Sub Indo",
  description: "Streaming anime terlengkap subtitle Indonesia. Nonton anime online gratis dengan kualitas terbaik.",
  manifest: "/manifest.json",
  icons: {
    icon: "/Doro-Orenji.png",
    apple: "/Doro-Orenji.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <head>
        <link rel="icon" href="/Doro-Orenji.png" type="image/png" />
        <link rel="apple-touch-icon" href="/Doro-Orenji.png" />
      </head>
      <body>
        <ServiceWorkerRegister />
        <WelcomePopup />
        <Navbar />
        <PWAInstallPrompt />

        <main className="mx-auto min-h-[70vh] max-w-6xl px-4 py-6">{children}</main>

        <footer className="border-t border-neutral-800 py-8 text-center text-xs text-neutral-500">
          <p>
            <span className="font-semibold text-neutral-300">OrenJiNime</span> By Gii~.
          </p>
          <p className="mt-1">
            Data anime bersumber dari pihak ketiga, streaming disediakan lewat API terpisah.
          </p>
        </footer>

        {/* Monetag ads — loaded lazily after page interactive so they don't
            block first paint. All zones from the active Monetag dashboard.
            These scripts attach themselves to the DOM and manage their own
            delivery (push notifications, vignette fullscreen, etc.). */}
        <Script
          id="monetag-zone-276849"
          src="https://quge5.com/88/tag.min.js"
          data-zone="276849"
          strategy="lazyOnload"
          async
        />
        <Script
          id="monetag-zone-11734052"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `(function(s){s.dataset.zone='11734052',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))`,
          }}
        />
        <Script
          id="monetag-zone-11734092"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `(function(s){s.dataset.zone='11734092',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))`,
          }}
        />
        <Script
          id="monetag-zone-11734101"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `(function(s){s.dataset.zone='11734101',s.src='https://al5sm.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))`,
          }}
        />
      </body>
    </html>
  );
}
