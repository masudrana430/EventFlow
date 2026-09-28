import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { updateProfileSchema } from "./user.validation";

const router = Router();

const allRoles = auth(
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.ORGANIZER,
  UserRole.EVENT_STAFF,
  UserRole.ATTENDEE,
);

router.patch(
  "/profile",
  allRoles,
  validateRequest(updateProfileSchema),
  UserController.updateMyProfile,
);

router.patch(
  "/profile-image",
  allRoles,
  upload.single("profileImage"),
  UserController.uploadProfileImage,
);

export const UserRoutes = router;
