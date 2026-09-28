import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { userValidation } from "./auth.validation";

const router = Router();

router.post(
  "/register",
  validateRequest(userValidation.attendeeRegistrationZodSchema),
  AuthController.registerAttendee,
);

router.post(
  "/resend-verification-otp",
  validateRequest(userValidation.forgotPasswordZodSchema),
  AuthController.resendAttendeeOtp,
);

router.post(
  "/verify-email",
  validateRequest(userValidation.attendeeEmailVerifyZodSchema),
  AuthController.verifyAttendeeEmail,
);

router.post(
  "/login",
  validateRequest(userValidation.loginZodSchema),
  AuthController.loginUser,
);

router.get(
  "/me",
  auth(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ORGANIZER,
    UserRole.EVENT_STAFF,
    UserRole.ATTENDEE,
  ),
  AuthController.getMe,
);

router.post("/refresh-token", AuthController.refreshToken);

router.post(
  "/google",
  validateRequest(userValidation.googleLoginZodSchema),
  AuthController.googleLogin,
);

router.post(
  "/forgot-password",
  validateRequest(userValidation.forgotPasswordZodSchema),
  AuthController.forgotPassword,
);

router.post(
  "/reset-password",
  validateRequest(userValidation.resetPasswordZodSchema),
  AuthController.resetPassword,
);

router.post(
  "/change-password",
  auth(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ORGANIZER,
    UserRole.EVENT_STAFF,
    UserRole.ATTENDEE,
  ),
  validateRequest(userValidation.changePasswordZodSchema),
  AuthController.changePassword,
);

router.post(
  "/set-password",
  auth(UserRole.ATTENDEE),
  validateRequest(userValidation.setPasswordZodSchema),
  AuthController.setPassword,
);

router.post(
  "/logout",
  auth(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ORGANIZER,
    UserRole.EVENT_STAFF,
    UserRole.ATTENDEE,
  ),
  AuthController.logout,
);

router.post(
  "/logout-all",
  auth(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ORGANIZER,
    UserRole.EVENT_STAFF,
    UserRole.ATTENDEE,
  ),
  AuthController.logoutAll,
);

export const AuthRoutes = router;
