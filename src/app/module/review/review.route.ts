import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { ReviewController } from "./review.controller";
import {
  createReviewSchema,
  reviewModerationSchema,
} from "./review.validation";

const router = Router();

router.get("/event/:eventId", ReviewController.eventReviews);

router.post(
  "/",
  auth(UserRole.ATTENDEE),
  validateRequest(createReviewSchema),
  ReviewController.create,
);

router.patch(
  "/:reviewId/moderate",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(reviewModerationSchema),
  ReviewController.moderate,
);

export const ReviewRoutes = router;
