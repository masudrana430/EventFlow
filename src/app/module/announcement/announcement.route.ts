import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AnnouncementController } from "./announcement.controller";
import { announcementSchema } from "./announcement.validation";

const router = Router();

router.post(
  "/",
  auth(UserRole.ORGANIZER),
  validateRequest(announcementSchema),
  AnnouncementController.send,
);

router.get(
  "/event/:eventId",
  auth(UserRole.ORGANIZER, UserRole.ATTENDEE, UserRole.EVENT_STAFF),
  AnnouncementController.listForEvent,
);

export const AnnouncementRoutes = router;
