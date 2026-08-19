import { prisma } from "@/lib/prisma";
import { AnimeStatus } from "@prisma/client";
import { AnimeCard } from "@/components/AnimeCard";
import { Pagination } from "@/components/Pagination";

export default async function AnimeListPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const statusParam = (searchParams.status || "ONGOING").toUpperCase();
  const status = (
    Object.values(AnimeStatus).includes(statusParam as AnimeStatus)
      ? statusParam
      : AnimeStatus.ONGOING
  ) as AnimeStatus;

  const currentPage = Number(searchParams.page) || 1;
  const pageSize = 18;

  const whereClause = { status };

  const [totalItems, animeList] = await Promise.all([
    prisma.anime.count({ where: whereClause }),
    prisma.anime.findMany({
      where: whereClause,
      take: pageSize,
      skip: (currentPage - 1) * pageSize,
      orderBy:
        status === AnimeStatus.ONGOING
          ? [
              { latestOrder: { sort: "asc", nulls: "last" } },
              { latestEpisodeRelease: { sort: "desc", nulls: "last" } },
            ]
          : [
              // Untuk COMPLETED: Diurutkan murni berdasarkan tanggal rilis episode asli
              { latestEpisodeRelease: { sort: "desc", nulls: "last" } },
            ],
      include: {
        episodes: { take: 1, orderBy: { episodeNumber: "desc" } },
      },
    }),
  ]);

  const totalPages = Math.ceil(totalItems / pageSize);

  return (
    <main className="space-y-6 pb-12">
      <h1 className="text-2xl font-bold text-white">
        Anime {status === AnimeStatus.ONGOING ? "Ongoing" : "Completed"}
      </h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {animeList.map((anime) => (
          <AnimeCard key={anime.slug} anime={anime} />
        ))}
      </div>

      <Pagination totalPages={totalPages} currentPage={currentPage} />
    </main>
  );
}