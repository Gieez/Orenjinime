"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ScheduleItem {
  title: string;
  url: string;
  featured_img_src: string;
  east_type: string;
  east_score: string;
  genre: string;
  east_time: string;
}

const DAYS = [
  { id: "monday", label: "Senin", nume: 1 },
  { id: "tuesday", label: "Selasa", nume: 2 },
  { id: "wednesday", label: "Rabu", nume: 3 },
  { id: "thursday", label: "Kamis", nume: 4 },
  { id: "friday", label: "Jumat", nume: 5 },
  { id: "saturday", label: "Sabtu", nume: 6 },
  { id: "sunday", label: "Minggu", nume: 7 },
];

export default function SchedulePage() {
  const [activeDay, setActiveDay] = useState("monday");
  const [scheduleList, setScheduleList] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fungsi untuk fetch data jadwal berdasarkan hari
  const fetchSchedule = async (day: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schedule?day=${day}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setScheduleList(data);
      } else {
        setScheduleList([]);
      }
    } catch (err) {
      console.error("Gagal memuat jadwal:", err);
      setScheduleList([]);
    } finally {
      setLoading(false);
    }
  };

  // Ambil data pertama kali saat halaman dibuka (Senin)
  useEffect(() => {
    fetchSchedule(activeDay);
  }, [activeDay]);

  const handleDayClick = (dayId: string) => {
    setActiveDay(dayId);
    fetchSchedule(dayId);
  };

  // Helper untuk mengubah URL Samehadaku ke route lokal /anime/[slug] jika ingin pakai sistem lokalmu
  const formatLocalUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split("/").filter(Boolean);
      // Asumsi format url: /anime/one-piece/ -> slug ada di index 1 atau terakhir
      const slug = segments[segments.length - 1] || segments[0];
      return `/anime/${slug}`;
    } catch {
      return url;
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pt-6">
      <div className="widget-title mb-6">
        <h1 className="text-2xl font-black tracking-tight text-white border-l-4 border-orange-500 pl-3">
          Jadwal Rilis
        </h1>
      </div>

      {/* Tombol Pilihan Hari */}
      <div id="the-days" className="mb-8">
        <ul className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {DAYS.map((d) => (
            <li key={d.id} className="list-none">
              <div
                onClick={() => handleDayClick(d.id)}
                className={`east_days_option text-center py-2 px-4 rounded-md text-sm font-medium cursor-pointer transition-all ${
                  activeDay === d.id
                    ? "bg-[#00b7e0] text-white border-[#00b7e0]"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                <span>{d.label}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Hasil Jadwal */}
      <div className="result-schedule">
        {loading ? (
          <div className="text-center py-20 text-zinc-500 animate-pulse">
            Memuat jadwal rilis...
          </div>
        ) : scheduleList.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="noschedule text-lg text-zinc-400">Tidak Ada Jadwal</h3>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {scheduleList.map((anime, idx) => {
              const localUrl = formatLocalUrl(anime.url);
              return (
                <div key={idx} className="animepost bg-[#121215] border border-zinc-800 rounded-xl overflow-hidden flex flex-col justify-between group hover:border-orange-500 transition-all">
                  <div className="animposx relative">
                    <Link href={localUrl}>
                      <div className="content-thumb relative aspect-[2/3] overflow-hidden bg-zinc-900">
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-all z-10 flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="w-10 h-10 rounded-full bg-orange-600 text-white flex items-center justify-center shadow-lg">
                            ▶
                          </div>
                        </div>
                        <img
                          src={anime.featured_img_src}
                          className="anmsa h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                          title={anime.title}
                          alt={anime.title}
                        />
                        <div className={`absolute top-2 left-2 z-20 text-[10px] font-bold px-2 py-0.5 rounded uppercase ${anime.east_type === 'TV' ? 'bg-orange-600 text-white' : 'bg-zinc-700 text-zinc-200'}`}>
                          {anime.east_type}
                        </div>
                        <div className="absolute top-2 right-2 z-20 bg-black/60 backdrop-blur-sm text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          ★ {anime.east_score}
                        </div>
                      </div>
                      <div className="data p-3">
                        <div className="title text-sm font-bold text-white line-clamp-1 group-hover:text-orange-400 transition-colors">
                          {anime.title}
                        </div>
                        <div className="type text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                          {anime.genre}
                        </div>
                      </div>
                    </Link>
                    <div className="data_tw px-3 pb-3 pt-0">
                      <Link href={localUrl} className="ltseps text-[11px] text-orange-400 flex items-center gap-1 font-semibold hover:underline">
                        <span>🕒 {anime.east_time}</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}