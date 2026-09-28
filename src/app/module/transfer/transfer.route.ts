import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { TransferController } from "./transfer.controller";
import {
  acceptTransferSchema,
  createTransferSchema,
} from "./transfer.validation";

const router = Router();

router.post(
  "/",
  auth(UserRole.ATTENDEE),
  validateRequest(createTransferSchema),
  TransferController.create,
);

router.post(
  "/accept",
  auth(UserRole.ATTENDEE),
  validateRequest(acceptTransferSchema),
  TransferController.accept,
);

router.get(
  "/mine",
  auth(UserRole.ATTENDEE),
  TransferController.mine,
);

export const TransferRoutes = router;
