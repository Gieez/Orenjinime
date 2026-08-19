export default function AnimeDetailLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse p-4 md:p-6 space-y-8">
      {/* Header & Detail Info Skeleton */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Poster */}
        <div className="w-full md:w-56 h-80 rounded-xl bg-neutral-800 shrink-0" />

        {/* Content Info */}
        <div className="flex-1 space-y-4">
          <div className="h-8 w-3/4 bg-neutral-800 rounded-md" />
          
          {/* Genre Badges */}
          <div className="flex flex-wrap gap-2 pt-1">
            <div className="h-6 w-16 bg-neutral-800 rounded-full" />
            <div className="h-6 w-20 bg-neutral-800 rounded-full" />
            <div className="h-6 w-24 bg-neutral-800 rounded-full" />
          </div>

          {/* Synopsis */}
          <div className="space-y-2 pt-2">
            <div className="h-4 w-full bg-neutral-800 rounded" />
            <div className="h-4 w-[90%] bg-neutral-800 rounded" />
            <div className="h-4 w-[80%] bg-neutral-800 rounded" />
          </div>

          {/* Meta Information */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4">
            <div className="h-12 bg-neutral-800 rounded-lg" />
            <div className="h-12 bg-neutral-800 rounded-lg" />
            <div className="h-12 bg-neutral-800 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Episode List Skeleton */}
      <div className="space-y-4 pt-4 border-t border-neutral-800">
        <div className="h-6 w-40 bg-neutral-800 rounded-md" />
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-11 bg-neutral-800 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}