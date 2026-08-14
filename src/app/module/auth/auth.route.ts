import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AuthController } from "./auth.controller";

const router = Router();

router.post(
	"/register",
	AuthController.registerAttendee,
);

router.post(
	"/login",
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

router.post(
	"/refresh-token",
	AuthController.refreshToken,
);
router.post("/google", AuthController.googleLogin)
export const AuthRoutes = router;