"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function Pagination({
  totalPages,
  currentPage,
}: {
  totalPages: number;
  currentPage: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const createPageUrl = (pageNumber: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", pageNumber.toString());
    return `${pathname}?${params.toString()}`;
  };

  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 3) {
        end = 4;
      } else if (currentPage >= totalPages - 2) {
        start = totalPages - 3;
      }

      if (start > 2) pages.push("...");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push("...");

      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 mt-8">
      {currentPage > 1 && (
        <Link
          href={createPageUrl(currentPage - 1)}
          className="rounded-lg bg-neutral-800 px-3 py-2 text-xs font-bold text-neutral-300 hover:bg-neutral-700"
        >
          ← Prev
        </Link>
      )}

      {getPageNumbers().map((page, idx) =>
        typeof page === "number" ? (
          <Link
            key={idx}
            href={createPageUrl(page)}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              page === currentPage
                ? "bg-brand text-white"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
          >
            {page}
          </Link>
        ) : (
          <span key={idx} className="px-2 text-xs text-neutral-500">
            ...
          </span>
        )
      )}

      {currentPage < totalPages && (
        <Link
          href={createPageUrl(currentPage + 1)}
          className="rounded-lg bg-neutral-800 px-3 py-2 text-xs font-bold text-neutral-300 hover:bg-neutral-700"
        >
          Next →
        </Link>
      )}
    </div>
  );
}