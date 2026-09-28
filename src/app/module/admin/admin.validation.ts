import { z } from "zod";

export const createAdminSchema = z.object({
  name: z.string().trim().min(3).max(100),
  email: z.email().trim().toLowerCase(),
  personalEmail: z.email().trim().toLowerCase(),
  phone: z.string().trim().min(6).max(30).optional(),
  role: z.enum(["ADMIN", "SUPER_ADMIN"]),
});

export const userStatusSchema = z.object({
  status: z.enum(["ACTIVE", "BLOCKED"]),
});

export const settingSchema = z.object({
  value: z.unknown(),
  description: z.string().max(500).optional(),
});
