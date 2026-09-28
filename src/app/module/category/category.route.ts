import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { CategoryController } from "./category.controller";
import {
  createCategorySchema,
  updateCategorySchema,
} from "./category.validation";

const router = Router();

router.get("/public", CategoryController.listPublic);

router.get(
  "/",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  CategoryController.listAll,
);

router.post(
  "/",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(createCategorySchema),
  CategoryController.create,
);

router.patch(
  "/:categoryId",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest(updateCategorySchema),
  CategoryController.update,
);

router.delete(
  "/:categoryId",
  auth(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  CategoryController.remove,
);

export const CategoryRoutes = router;
