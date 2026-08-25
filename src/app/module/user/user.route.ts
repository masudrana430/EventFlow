/** biome-ignore-all lint/correctness/noUnusedImports: <explanation> */
/** biome-ignore-all assist/source/organizeImports: <explanation> */
import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { UserController } from "./user.controller";

const router = Router();

router.patch(
	"/profile-image",

	auth(
		UserRole.SUPER_ADMIN,
		UserRole.ADMIN,
		UserRole.ORGANIZER,
		UserRole.EVENT_STAFF,
		UserRole.ATTENDEE,
	),

	upload.single("profileImage"),

	UserController.uploadProfileImage,
);

export const UserRoutes = router;