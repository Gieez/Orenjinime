"use client";

import { useState } from "react";

const ADSENSE_CLIENT = "ca-pub-6369400192111860";

/**
 * Non-intrusive ad banner — tampil di antara konten.
 * Google AdSense integration.
 */
export function AdBanner({ position }: { position: "top" | "middle" | "bottom" }) {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="my-4 rounded-xl border border-neutral-800/50 bg-neutral-900/50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wider text-neutral-600">Ad</span>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="text-neutral-600 hover:text-neutral-400 text-[10px]"
          aria-label="Close ad"
        >
          x
        </button>
      </div>

      {/* Google AdSense Banner */}
      <div className="flex items-center justify-center py-2">
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot="auto"
          data-ad-format="horizontal"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
