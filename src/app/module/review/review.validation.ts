import { z } from "zod";

export const createReviewSchema = z.object({
  eventId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(5).max(3000),
  images: z.array(z.url()).max(5).default([]),
});

export const reviewModerationSchema = z.object({
  status: z.enum(["VISIBLE", "HIDDEN"]),
});
