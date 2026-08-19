import { AnimeCard, AnimeCardData } from "./AnimeCard";

export function AnimeSection({
  title,
  items,
  variant = "grid",
  viewAllHref,
}: {
  title: string;
  items: AnimeCardData[];
  /** "grid" = grid statis, "scroll" = baris horizontal scroll */
  variant?: "grid" | "scroll";
  viewAllHref?: string;
}) {
  if (!items || items.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-neutral-100">{title}</h2>
        {viewAllHref && (
          <a href={viewAllHref} className="text-xs font-semibold text-brand hover:text-brand-light">
            Lihat Semua →
          </a>
        )}
      </div>

      {variant === "scroll" ? (
        <div className="scrollbar-hide snap-row -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {items.map((anime) => (
            <div key={anime.slug} className="w-[130px] shrink-0 sm:w-[160px]">
              <AnimeCard anime={anime} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map((anime) => (
            <AnimeCard key={anime.slug} anime={anime} />
          ))}
        </div>
      )}
    </section>
  );
}