import { z } from "zod";

const dateString = z.string().datetime();

export const createEventSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().trim().min(3).max(180),
  shortDescription: z.string().trim().min(10).max(300),
  description: z.string().trim().min(20).max(10000),
  venueName: z.string().trim().min(2).max(200),
  venueAddress: z.string().trim().min(5).max(500),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  startDateTime: dateString,
  endDateTime: dateString,
  entryOpenTime: dateString,
  saleStartAt: dateString,
  saleEndAt: dateString,
  contactEmail: z.email(),
  contactPhone: z.string().trim().max(30).optional(),
  ageRestriction: z.number().int().min(0).max(100).optional(),
  policies: z.array(z.string().trim().min(1).max(500)).default([]),
  refundPolicyType: z
    .enum([
      "DEFAULT",
      "FULL_UNTIL",
      "PARTIAL_UNTIL",
      "NON_REFUNDABLE",
      "ORGANIZER_APPROVAL",
    ])
    .default("DEFAULT"),
  refundDeadline: dateString.optional(),
  refundPercentage: z.number().int().min(0).max(100).optional(),
  capacity: z.number().int().positive(),
  publishAt: dateString.optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const reviewEventSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
  reason: z.string().trim().min(5).max(2000).optional(),
});

export const eventStatusReasonSchema = z.object({
  reason: z.string().trim().min(5).max(2000),
});
