import { prisma } from "@/lib/prisma";
import { AnimeCard } from "@/components/AnimeCard";
import { notFound } from "next/navigation";

export default async function GenreDetailPage({ params }: { params: { slug: string } }) {
  const genre = await prisma.genre.findUnique({ where: { slug: params.slug } });
  if (!genre) notFound();

  const items = await prisma.anime.findMany({
    where: { genres: { some: { genreId: genre.id } } },
    orderBy: { popularity: "desc" },
    take: 30,
  });

  return (
    <div>
      <div className="mb-6">
        <span className="text-xs font-semibold uppercase tracking-wide text-brand">Genre</span>
        <h1 className="text-2xl font-extrabold text-white">{genre.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">{items.length} anime ditemukan</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-sm text-neutral-400">
          Belum ada anime untuk genre ini.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map((a) => (
            <AnimeCard key={a.slug} anime={a} />
          ))}
        </div>
      )}
    </div>
  );
}