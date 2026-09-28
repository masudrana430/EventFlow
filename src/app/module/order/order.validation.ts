import { z } from "zod";

export const checkoutSchema = z.object({
  ticketTypeId: z.string().min(1),
  quantity: z.number().int().positive(),
  promoCode: z.string().trim().min(3).max(40).optional(),
});
