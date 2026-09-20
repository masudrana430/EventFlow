import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { WaitlistController } from "./waitlist.controller";
import { joinWaitlistSchema } from "./waitlist.validation";

const router = Router();

router.post(
  "/",
  auth(UserRole.ATTENDEE),
  validateRequest(joinWaitlistSchema),
  WaitlistController.join,
);

router.delete(
  "/:ticketTypeId",
  auth(UserRole.ATTENDEE),
  WaitlistController.leave,
);

router.get(
  "/mine",
  auth(UserRole.ATTENDEE),
  WaitlistController.mine,
);

export const WaitlistRoutes = router;
