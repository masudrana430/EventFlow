import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { TicketTypeController } from "./ticketType.controller";
import {
  createTicketTypeSchema,
  updateTicketTypeSchema,
} from "./ticketType.validation";

const router = Router();

router.get("/event/:eventId/public", TicketTypeController.listPublic);

router.post(
  "/event/:eventId",
  auth(UserRole.ORGANIZER),
  validateRequest(createTicketTypeSchema),
  TicketTypeController.create,
);

router.patch(
  "/:ticketTypeId",
  auth(UserRole.ORGANIZER),
  validateRequest(updateTicketTypeSchema),
  TicketTypeController.update,
);

router.delete(
  "/:ticketTypeId",
  auth(UserRole.ORGANIZER),
  TicketTypeController.remove,
);

export const TicketTypeRoutes = router;
