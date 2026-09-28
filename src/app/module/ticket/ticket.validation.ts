import { z } from "zod";

export const qrCheckInSchema = z.object({
  eventId: z.string().min(1),
  qrPayload: z.string().min(20),
  deviceInfo: z.string().max(500).optional(),
});

export const manualCheckInSchema = z.object({
  eventId: z.string().min(1),
  ticketId: z.string().min(1),
  confirm: z.literal(true),
  deviceInfo: z.string().max(500).optional(),
});
