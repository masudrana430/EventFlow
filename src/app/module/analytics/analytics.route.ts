import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AnalyticsController } from "./analytics.controller";

const router = Router();

router.get(
  "/attendee",
  auth(UserRole.ATTENDEE),
  AnalyticsController.attendee,
);
router.get(
  "/organizer",
  auth(UserRole.ORGANIZER),
  AnalyticsController.organizer,
);
router.get(
  "/staff",
  auth(UserRole.EVENT_STAFF),
  AnalyticsController.staff,
);
router.get(
  "/admin",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  AnalyticsController.admin,
);

export const AnalyticsRoutes = router;
