export default function DukunganPage() {
  // 💡 Ganti dengan link SociaBuzz milikmu
  const sociabuzzUrl = "https://sociabuzz.com/mochiigii/tribe";

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-orange-500/10 text-4xl">
        ☕
      </div>

      <h1 className="mb-3 text-3xl font-bold md:text-4xl">
        Dukung <span className="text-orange-500">OrenjiNime</span>
      </h1>

      <p className="mb-8 text-sm leading-relaxed text-neutral-400 md:text-base">
        Suka nonton di OrenjiNime? Dukungan dari kamu sangat berarti untuk membantu kelancaran biaya server agar website ini bisa terus aktif, cepat, dan nyaman digunakan!
      </p>

      <a
        href={sociabuzzUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-2 rounded-full bg-orange-500 px-8 py-3.5 font-semibold text-white transition hover:bg-orange-600 hover:shadow-lg hover:shadow-orange-500/20"
      >
        <span>Dukung via SociaBuzz</span>
        <svg
          className="h-4 w-4 transition-transform group-hover:translate-x-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </a>

      <div className="mt-12 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 text-xs text-neutral-500">
        Berapapun nominal dukungan kamu, sangat berharga buat kelangsungan OrenjiNime. Terima kasih! 🧡
      </div>
    </div>
  );
}