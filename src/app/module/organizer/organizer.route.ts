import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { OrganizerController } from "./organizer.controller";
import {
  organizerDecisionSchema,
  organizerUpdateSchema,
  organizerVerifySchema,
} from "./organizer.validation";

const router = Router();

router.post(
  "/apply",
  upload.single("verificationDocument"),
  OrganizerController.apply,
);

router.post(
  "/verify-email",
  validateRequest(organizerVerifySchema),
  OrganizerController.verify,
);

router.get(
  "/applications",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  OrganizerController.listApplications,
);

router.patch(
  "/applications/:organizerId/decision",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(organizerDecisionSchema),
  OrganizerController.decide,
);

router.get(
  "/me",
  auth(UserRole.ORGANIZER),
  OrganizerController.getMyProfile,
);

router.patch(
  "/me",
  auth(UserRole.ORGANIZER),
  validateRequest(organizerUpdateSchema),
  OrganizerController.updateMyProfile,
);

export const OrganizerRoutes = router;
