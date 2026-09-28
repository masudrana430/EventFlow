import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { OrderController } from "../order/order.controller";

const router = Router();

router.get("/uddoktapay/callback", OrderController.callback);
router.get("/uddoktapay/cancel", OrderController.cancel);
router.post("/uddoktapay/webhook", OrderController.webhook);

router.get(
  "/my-payments",
  auth(UserRole.ATTENDEE),
  OrderController.myPayments,
);

router.get(
  "/all",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  OrderController.allPayments,
);

export const PaymentRoutes = router;
