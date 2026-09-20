import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PromoController } from "./promo.controller";
import { createPromoSchema, updatePromoSchema } from "./promo.validation";

const router = Router();

router.post(
  "/",
  auth(UserRole.ORGANIZER),
  validateRequest(createPromoSchema),
  PromoController.create,
);

router.get(
  "/event/:eventId",
  auth(UserRole.ORGANIZER),
  PromoController.list,
);

router.patch(
  "/:promoId",
  auth(UserRole.ORGANIZER),
  validateRequest(updatePromoSchema),
  PromoController.update,
);

export const PromoRoutes = router;
