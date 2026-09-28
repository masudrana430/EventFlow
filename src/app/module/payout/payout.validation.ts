import { z } from "zod";

export const payoutDecisionSchema = z.object({
  status: z.enum(["PROCESSING", "PAID", "HELD", "REJECTED", "FAILED"]),
  paymentReference: z.string().trim().max(200).optional(),
  holdReason: z.string().trim().max(2000).optional(),
});
