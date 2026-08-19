import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const searchQuerySchema = paginationSchema.extend({
  q: z.string().trim().min(1).optional(),
  genre: z.string().trim().optional(),
  year: z.coerce.number().int().optional(),
  status: z.enum(["ONGOING", "COMPLETED", "UPCOMING"]).optional(),
  type: z.enum(["TV", "MOVIE", "OVA", "ONA", "SPECIAL"]).optional(),
});

export const animeListQuerySchema = paginationSchema.extend({
  status: z.enum(["ONGOING", "COMPLETED", "UPCOMING"]).optional(),
  type: z.enum(["TV", "MOVIE", "OVA", "ONA", "SPECIAL"]).optional(),
  genre: z.string().trim().optional(),
  sort: z.enum(["latest", "popular", "rating", "title"]).default("latest"),
});
