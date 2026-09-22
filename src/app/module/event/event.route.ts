import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { EventController } from "./event.controller";
import {
  createEventSchema,
  eventStatusReasonSchema,
  reviewEventSchema,
  updateEventSchema,
} from "./event.validation";

const router = Router();

router.get("/public", EventController.publicList);
router.get("/public/:eventIdOrSlug", EventController.publicDetails);

router.get("/my-events", auth(UserRole.ORGANIZER), EventController.myEvents);

router.post(
  "/",
  auth(UserRole.ORGANIZER),
  validateRequest(createEventSchema),
  EventController.create,
);

router.patch(
  "/:eventId",
  auth(UserRole.ORGANIZER),
  validateRequest(updateEventSchema),
  EventController.update,
);

router.patch(
  "/:eventId/cover",
  auth(UserRole.ORGANIZER),
  upload.single("coverImage"),
  EventController.uploadCover,
);

router.patch(
  "/:eventId/gallery",
  auth(UserRole.ORGANIZER),
  upload.array("galleryImages", 8),
  EventController.uploadGallery,
);

router.post(
  "/:eventId/submit",
  auth(UserRole.ORGANIZER),
  EventController.submitForReview,
);

router.post(
  "/:eventId/publish",
  auth(UserRole.ORGANIZER),
  EventController.publish,
);

router.post(
  "/:eventId/cancel",
  auth(UserRole.ORGANIZER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(eventStatusReasonSchema),
  EventController.cancel,
);

router.get(
  "/admin/all",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  EventController.adminList,
);

router.post(
  "/admin/:eventId/review",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(reviewEventSchema),
  EventController.review,
);

router.post(
  "/admin/:eventId/suspend",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(eventStatusReasonSchema),
  EventController.suspend,
);

router.post(
  "/admin/:eventId/restore",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  EventController.restore,
);

export const EventRoutes = router;
