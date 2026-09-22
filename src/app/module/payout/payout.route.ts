import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PayoutController } from "./payout.controller";
import { payoutDecisionSchema } from "./payout.validation";

const router = Router();

router.post(
  "/event/:eventId/request",
  auth(UserRole.ORGANIZER),
  PayoutController.request,
);

router.get("/mine", auth(UserRole.ORGANIZER), PayoutController.mine);

router.get(
  "/all",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  PayoutController.all,
);

router.patch(
  "/:payoutId/status",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(payoutDecisionSchema),
  PayoutController.decide,
);

export const PayoutRoutes = router;
