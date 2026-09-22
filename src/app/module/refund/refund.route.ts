import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { RefundController } from "./refund.controller";
import {
  decideRefundSchema,
  markRefundedSchema,
  requestRefundSchema,
} from "./refund.validation";

const router = Router();

router.post(
  "/",
  auth(UserRole.ATTENDEE),
  validateRequest(requestRefundSchema),
  RefundController.request,
);

router.get(
  "/organizer",
  auth(UserRole.ORGANIZER),
  RefundController.organizerList,
);

router.get(
  "/all",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  RefundController.all,
);

router.patch(
  "/:refundId/decision",
  auth(UserRole.ORGANIZER, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(decideRefundSchema),
  RefundController.decide,
);

router.patch(
  "/:refundId/complete",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(markRefundedSchema),
  RefundController.markRefunded,
);

export const RefundRoutes = router;
