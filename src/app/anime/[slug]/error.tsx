"use client";

export default function AnimeDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center">
      <div className="text-center space-y-4 p-8">
        <div className="text-6xl">😵</div>
        <h2 className="text-xl font-bold text-white">Terjadi kesalahan</h2>
        <p className="text-sm text-zinc-400 max-w-md">
          Gagal memuat data anime. Coba refresh halaman atau kembali ke beranda.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-500"
          >
            Coba Lagi
          </button>
          <a
            href="/"
            className="rounded-lg bg-neutral-800 px-5 py-2.5 text-sm font-bold text-neutral-300 transition hover:bg-neutral-700"
          >
            Beranda
          </a>
        </div>
      </div>
    </main>
  );
}
