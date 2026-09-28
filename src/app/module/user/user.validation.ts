import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(3).max(100).optional(),
  phone: z.string().trim().min(6).max(30).nullable().optional(),
  attendee: z
    .object({
      phone: z.string().trim().min(6).max(30).nullable().optional(),
      location: z.string().trim().max(150).nullable().optional(),
    })
    .optional(),
});
