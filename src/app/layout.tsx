import type { Metadata } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "OrenGiNime",
  description: "Streaming anime terlengkap - katalog, jadwal, dan berita anime.",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body>
        <ServiceWorkerRegister />
        <Navbar />

        <main className="mx-auto min-h-[70vh] max-w-6xl px-4 py-6">{children}</main>

        <footer className="border-t border-neutral-800 py-8 text-center text-xs text-neutral-500">
          <p>
            <span className="font-semibold text-neutral-300">OrenGiNime</span> By Gii~.
          </p>
          <p className="mt-1">
            Data anime bersumber dari pihak ketiga, streaming disediakan lewat API terpisah.
          </p>
        </footer>
      </body>
    </html>
  );
}