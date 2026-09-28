import { z } from "zod";

export const createTicketTypeSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional(),
  price: z.number().min(0),
  quantity: z.number().int().positive(),
  maxPerOrder: z.number().int().positive().max(50).default(10),
  saleStartAt: z.string().datetime(),
  saleEndAt: z.string().datetime(),
  transferable: z.boolean().default(true),
  refundable: z.boolean().default(true),
  benefits: z.array(z.string().trim().min(1).max(300)).default([]),
  isVisible: z.boolean().default(true),
});

export const updateTicketTypeSchema = createTicketTypeSchema.partial();
