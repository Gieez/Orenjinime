"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already dismissed today
    const dismissedAt = localStorage.getItem("pwa_dismissed");
    if (dismissedAt) {
      const today = new Date().toDateString();
      const dismissedDate = new Date(Number(dismissedAt)).toDateString();
      if (today === dismissedDate) {
        setDismissed(true);
        return;
      }
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after 30 seconds
      setTimeout(() => setShowPrompt(true), 30000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem("pwa_dismissed", String(Date.now()));
  };

  if (dismissed || !showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-2xl shadow-black/50">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg">
            <img src="/icon.svg" alt="OrenJiNime" className="h-10 w-10" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Install OrenJiNime</p>
            <p className="mt-0.5 text-xs text-neutral-400">
              Pasang sebagai app di HP kamu. Lebih cepat diakses.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleInstall}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-dark"
              >
                Install
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-400 transition hover:text-white"
              >
                Nanti aja
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
