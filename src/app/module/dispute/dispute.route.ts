import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { DisputeController } from "./dispute.controller";
import {
  createDisputeSchema,
  disputeDecisionSchema,
  organizerResponseSchema,
} from "./dispute.validation";

const router = Router();

router.post(
  "/",
  auth(UserRole.ATTENDEE),
  validateRequest(createDisputeSchema),
  DisputeController.create,
);

router.get("/mine", auth(UserRole.ATTENDEE), DisputeController.mine);

router.get(
  "/organizer",
  auth(UserRole.ORGANIZER),
  DisputeController.organizerList,
);

router.post(
  "/:disputeId/respond",
  auth(UserRole.ORGANIZER),
  validateRequest(organizerResponseSchema),
  DisputeController.organizerRespond,
);

router.get(
  "/admin/all",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  DisputeController.adminList,
);

router.patch(
  "/admin/:disputeId/decision",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(disputeDecisionSchema),
  DisputeController.decide,
);

export const DisputeRoutes = router;
