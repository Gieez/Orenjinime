export function formatRating(rating: number | null | undefined): string {
  if (rating == null || rating <= 0) return "N/A";
  let val = rating;
  while (val > 10) {
    val = val / 10;
  }
  return val.toFixed(1);
}

/**
 * Helper untuk membersihkan URL thumbnail WordPress/sumber scraper.
 */
export function getCleanImageUrl(url?: string | null): string {
  if (!url) return "";

  return url
    .replace(/-\d+x\d+(?=\.(jpg|jpeg|png|webp|gif))/i, "")
    .split("?")[0];
}

/**
 * Helper format waktu rilis relatif (misal: "2m lalu", "3j lalu")
 */
export function timeAgo(dateInput?: Date | string | null): string {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Baru saja";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}j lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d lalu`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}bln lalu`;
  return `${Math.floor(months / 12)}thn lalu`;
}