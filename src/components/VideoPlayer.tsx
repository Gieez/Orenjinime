"use client";

import React, { useState, useEffect } from 'react';

interface ServerSource {
  type: string;
  id: string;
  createdAt: Date | string;
  name: string;
  episodeId: string;
  url: string;
  quality: string | null;
}

interface VideoPlayerProps {
  animeSlug: string;
  episodeNumber: number;
  servers: ServerSource[];
  introStart: number | null;
  introEnd: number | null;
}

export default function VideoPlayer({
  servers,
}: VideoPlayerProps) {
  const [selectedServer, setSelectedServer] = useState<ServerSource | null>(servers?.[0] || null);

  useEffect(() => {
    if (servers && servers.length > 0) {
      setSelectedServer(servers[0]);
    }
  }, [servers]);

  // Pengaman jika server kosong atau URL tidak valid agar tidak merusak render / looping
  if (!selectedServer || !selectedServer.url) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-neutral-400">
        <p className="text-sm font-semibold text-red-400">⚠️ Sumber video (Server) tidak tersedia atau kosong.</p>
        <p className="text-xs text-neutral-500">Silakan cek kembali server lain jika ada.</p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Container Video / Iframe */}
      <div className="relative aspect-video overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-lg shadow-black/40">
        <iframe
          src={selectedServer.url}
          className="h-full w-full border-0"
          allowFullScreen
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      {/* Pilihan Server */}
      {servers.length > 1 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Pilih Server
          </h3>
          <div className="flex flex-wrap gap-2">
            {servers.map((server) => {
              const isSelected = selectedServer?.id === server.id;
              return (
                <button
                  key={server.id}
                  type="button"
                  onClick={() => setSelectedServer(server)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    isSelected
                      ? "bg-brand text-white shadow-md"
                      : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                  }`}
                >
                  {server.name} {server.quality ? `(${server.quality})` : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}