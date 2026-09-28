import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { OrderController } from "./order.controller";
import { checkoutSchema } from "./order.validation";

const router = Router();

router.post(
  "/checkout",
  auth(UserRole.ATTENDEE),
  validateRequest(checkoutSchema),
  OrderController.checkout,
);

router.get(
  "/my-orders",
  auth(UserRole.ATTENDEE),
  OrderController.myOrders,
);

router.get(
  "/my-orders/:orderId",
  auth(UserRole.ATTENDEE),
  OrderController.getMyOrder,
);

export const OrderRoutes = router;
