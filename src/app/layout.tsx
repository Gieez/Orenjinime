import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { Navbar } from "@/components/Navbar";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { WelcomePopup } from "@/components/WelcomePopup";

const ADSENSE_CLIENT = "ca-pub-6369400192111860";

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
        <Script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
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
      </body>
    </html>
  );
}
