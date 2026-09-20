import { z } from "zod";

export const createPromoSchema = z.object({
  eventId: z.string().min(1),
  code: z.string().trim().min(3).max(40),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  value: z.number().positive(),
  maxUses: z.number().int().positive().optional(),
  minOrderAmount: z.number().min(0).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

export const updatePromoSchema = createPromoSchema
  .omit({ eventId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });
