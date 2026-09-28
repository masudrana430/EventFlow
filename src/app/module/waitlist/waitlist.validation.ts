import { z } from "zod";

export const joinWaitlistSchema = z.object({
  ticketTypeId: z.string().min(1),
});
