import { z } from "zod";

const attendeeRegistrationZodSchema = z.object({
  name: z
    .string("Name must be a string")
    .trim()
    .min(3, "Name must be at least 3 characters")
    .max(100, "Name must not exceed 100 characters"),

  email: z.email("Invalid email address").trim().toLowerCase(),

  password: z
    .string("Password must be a string")
    .min(8, "Password must be at least 8 characters long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),

  attendee: z
    .object({
      phone: z.string("Phone must be a string").trim().optional(),

      location: z
        .string("Location must be a string")
        .trim()
        .max(150)
        .optional(),
    })
    .optional(),
});

const LoginZodSchema = z.object({
    email : z.email(),
    password: z.string()
        .min(8, "Password Must Minimum 8 Characters Long.")
        .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
        .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

        .regex(/[0-9]/, "Password must contain atleast 1 Number")
        .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
})

const ForgotPasswordZodSchema = z.object({
    email: z.email()
})

const ResetPasswordZodSchema = z.object({
    email: z.email(),
    newPassword: z.string()
        .min(8, "Password Must Minimum 8 Characters Long.")
        .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
        .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

        .regex(/[0-9]/, "Password must contain atleast 1 Number")
        .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
    otp : z.string().length(6)
})


export const userValidation = {
  attendeeRegistrationZodSchema,
  loginZodSchema: LoginZodSchema,
  ForgotPasswordZodSchema,
  ResetPasswordZodSchema
};
