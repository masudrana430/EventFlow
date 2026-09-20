import { z } from "zod";

const password = z
  .string()
  .min(8)
  .regex(/[A-Z]/)
  .regex(/[a-z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);

export const organizerApplicationSchema = z.object({
  user: z.object({
    name: z.string().trim().min(3).max(100),
    email: z.email().trim().toLowerCase(),
    password,
  }),
  organizer: z.object({
    organizationName: z.string().trim().min(2).max(150),
    organizationType: z.string().trim().max(100).optional(),
    phone: z.string().trim().min(6).max(30),
    address: z.string().trim().min(5).max(500),
    experience: z.string().trim().max(2000).optional(),
    websiteUrl: z.url().optional(),
    socialMediaUrl: z.url().optional(),
  }),
});

export const organizerVerifySchema = z.object({
  email: z.email().trim().toLowerCase(),
  otp: z.string().regex(/^\d{6}$/),
});

export const organizerDecisionSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().trim().min(5).max(1000).optional(),
});

export const organizerUpdateSchema = z.object({
  organizationName: z.string().trim().min(2).max(150).optional(),
  organizationType: z.string().trim().max(100).optional(),
  phone: z.string().trim().min(6).max(30).optional(),
  address: z.string().trim().min(5).max(500).optional(),
  experience: z.string().trim().max(2000).optional(),
  websiteUrl: z.url().nullable().optional(),
  socialMediaUrl: z.url().nullable().optional(),
  payoutAccountName: z.string().trim().max(150).optional(),
  payoutAccountNumber: z.string().trim().max(100).optional(),
  payoutMethod: z.string().trim().max(100).optional(),
});
