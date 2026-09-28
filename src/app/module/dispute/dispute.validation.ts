import { z } from "zod";

export const createDisputeSchema = z.object({
  orderId: z.string().min(1),
  ticketId: z.string().min(1).optional(),
  reason: z.string().trim().min(3).max(150),
  description: z.string().trim().min(10).max(5000),
  evidenceUrls: z.array(z.url()).max(10).default([]),
});

export const organizerResponseSchema = z.object({
  response: z.string().trim().min(5).max(5000),
});

export const disputeDecisionSchema = z.object({
  decision: z.enum(["REJECT", "PARTIAL_REFUND", "FULL_REFUND", "WARNING"]),
  refundAmount: z.number().min(0).optional(),
  note: z.string().trim().min(3).max(5000),
});
