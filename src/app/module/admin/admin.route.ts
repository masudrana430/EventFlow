import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AdminController } from "./admin.controller";
import {
  createAdminSchema,
  settingSchema,
  userStatusSchema,
} from "./admin.validation";

const router = Router();

router.post(
  "/accounts",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(createAdminSchema),
  AdminController.createAdmin,
);

router.get(
  "/users",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  AdminController.listUsers,
);

router.patch(
  "/users/:userId/status",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(userStatusSchema),
  AdminController.updateUserStatus,
);

router.get(
  "/audit-logs",
  auth(UserRole.SUPER_ADMIN),
  AdminController.getAuditLogs,
);

router.get(
  "/settings",
  auth(UserRole.SUPER_ADMIN),
  AdminController.listSettings,
);

router.put(
  "/settings/:key",
  auth(UserRole.SUPER_ADMIN),
  validateRequest(settingSchema),
  AdminController.upsertSetting,
);

export const AdminRoutes = router;
