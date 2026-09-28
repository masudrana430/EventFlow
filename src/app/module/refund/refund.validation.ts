import { z } from "zod";

export const requestRefundSchema = z.object({
  ticketId: z.string().min(1),
  reason: z.string().trim().min(10).max(2000),
});

export const decideRefundSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  approvedAmount: z.number().min(0).optional(),
  reason: z.string().trim().min(5).max(2000).optional(),
});

export const markRefundedSchema = z.object({
  gatewayRefundId: z.string().trim().min(2).max(200),
});
