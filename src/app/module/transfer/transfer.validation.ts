import { z } from "zod";

export const createTransferSchema = z.object({
  ticketId: z.string().min(1),
  recipientEmail: z.email().trim().toLowerCase(),
});

export const acceptTransferSchema = z.object({
  token: z.string().min(20),
});
