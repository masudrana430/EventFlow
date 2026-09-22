import { z } from "zod";

export const inviteStaffSchema = z.object({
  name: z.string().trim().min(3).max(100),
  email: z.email().trim().toLowerCase(),
  eventIds: z.array(z.string().min(1)).min(1),
});

export const acceptStaffSchema = z.object({
  token: z.string().min(20),
});

export const assignStaffSchema = z.object({
  eventIds: z.array(z.string().min(1)).min(1),
});
