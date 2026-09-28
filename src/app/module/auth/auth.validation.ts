import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

const attendeeRegistrationZodSchema = z.object({
  name: z.string().trim().min(3).max(100),
  email: z.email().trim().toLowerCase(),
  password: passwordSchema,
  attendee: z
    .object({
      phone: z.string().trim().optional(),
      location: z.string().trim().max(150).optional(),
    })
    .optional(),
});

const attendeeEmailVerifyZodSchema = z.object({
  email: z.email().trim().toLowerCase(),
  otp: z.string().regex(/^\d{6}$/, "OTP must contain 6 digits"),
});

const loginZodSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

const forgotPasswordZodSchema = z.object({
  email: z.email().trim().toLowerCase(),
});

const resetPasswordZodSchema = z.object({
  email: z.email().trim().toLowerCase(),
  newPassword: passwordSchema,
  otp: z.string().regex(/^\d{6}$/, "OTP must contain 6 digits"),
});

const googleLoginZodSchema = z.object({
  idToken: z.string().min(20),
});

const changePasswordZodSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

const setPasswordZodSchema = z.object({
  newPassword: passwordSchema,
});

export const userValidation = {
  attendeeRegistrationZodSchema,
  attendeeEmailVerifyZodSchema,
  loginZodSchema,
  forgotPasswordZodSchema,
  resetPasswordZodSchema,
  googleLoginZodSchema,
  changePasswordZodSchema,
  setPasswordZodSchema,
};
