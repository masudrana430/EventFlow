import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { NotificationController } from "./notification.controller";

const router = Router();

const allRoles = auth(
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.ORGANIZER,
  UserRole.EVENT_STAFF,
  UserRole.ATTENDEE,
);

router.get("/", allRoles, NotificationController.listMine);
router.patch("/read-all", allRoles, NotificationController.markAllRead);
router.patch("/:notificationId/read", allRoles, NotificationController.markRead);

export const NotificationRoutes = router;
