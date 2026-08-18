/** biome-ignore-all lint/correctness/noUnusedImports: <explanation> */
/** biome-ignore-all assist/source/organizeImports: <explanation> */
import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AuthController } from "./auth.controller";
import { userValidation } from "./auth.validation";
import { validateRequest } from "../../middleware/validateRequest";

const router = Router();

router.post(
  "/register",
  validateRequest(userValidation.attendeeRegistrationZodSchema),
  AuthController.registerAttendee,
);

router.post(
  "/login",
  validateRequest(userValidation.loginZodSchema),
  AuthController.loginUser,
);

router.get(
  "/me",
  auth(
    UserRole.ADMIN,
    UserRole.ORGANIZER,
    UserRole.EVENT_STAFF,
    UserRole.ATTENDEE,
    UserRole.SUPER_ADMIN,
  ),
  AuthController.getMe,
);

router.post("/refresh-token", AuthController.refreshToken);
router.post("/google", AuthController.googleLogin);

router.post(
  "/forgot-password",
  validateRequest(userValidation.ForgotPasswordZodSchema),
  AuthController.forgotPassword,
);
router.post(
  "/reset-password",
  validateRequest(userValidation.ResetPasswordZodSchema),
  AuthController.resetPassword,
);
export const AuthRoutes = router;
