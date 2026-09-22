import { z } from "zod";

export const announcementSchema = z.object({
  eventId: z.string().min(1),
  title: z.string().trim().min(3).max(150),
  message: z.string().trim().min(5).max(5000),
});
