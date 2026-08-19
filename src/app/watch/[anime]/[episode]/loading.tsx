export default function WatchEpisodeLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse p-4 md:p-6 space-y-6">
      {/* Breadcrumb Skeleton */}
      <div className="h-4 w-64 bg-neutral-800 rounded" />

      {/* Title Skeleton */}
      <div className="h-8 w-3/4 md:w-1/2 bg-neutral-800 rounded-md" />

      {/* Video Player Box Skeleton */}
      <div className="relative aspect-video w-full rounded-2xl bg-neutral-800 shadow-xl overflow-hidden flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-neutral-700/50" />
      </div>

      {/* Server Selector Box Skeleton */}
      <div className="space-y-3 rounded-xl bg-neutral-900/60 p-4 border border-neutral-800">
        <div className="h-4 w-28 bg-neutral-800 rounded" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-32 bg-neutral-800 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}