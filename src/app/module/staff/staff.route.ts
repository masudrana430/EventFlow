import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { StaffController } from "./staff.controller";
import {
  acceptStaffSchema,
  assignStaffSchema,
  inviteStaffSchema,
} from "./staff.validation";

const router = Router();

router.post(
  "/accept",
  validateRequest(acceptStaffSchema),
  StaffController.accept,
);

router.get(
  "/my-assignments",
  auth(UserRole.EVENT_STAFF),
  StaffController.myAssignments,
);

router.get(
  "/",
  auth(UserRole.ORGANIZER),
  StaffController.list,
);

router.post(
  "/invite",
  auth(UserRole.ORGANIZER),
  validateRequest(inviteStaffSchema),
  StaffController.invite,
);

router.patch(
  "/:staffId/assign",
  auth(UserRole.ORGANIZER),
  validateRequest(assignStaffSchema),
  StaffController.assign,
);

router.delete(
  "/:staffId",
  auth(UserRole.ORGANIZER),
  StaffController.revoke,
);

export const StaffRoutes = router;
