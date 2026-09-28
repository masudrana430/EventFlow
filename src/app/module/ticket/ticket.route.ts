import { Router } from "express";
import { UserRole } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { TicketController } from "./ticket.controller";
import {
  manualCheckInSchema,
  qrCheckInSchema,
} from "./ticket.validation";

const router = Router();

router.get(
  "/my-tickets",
  auth(UserRole.ATTENDEE),
  TicketController.myTickets,
);

router.get(
  "/my-tickets/:ticketId",
  auth(UserRole.ATTENDEE),
  TicketController.getMyTicket,
);

router.get(
  "/my-tickets/:ticketId/pdf",
  auth(UserRole.ATTENDEE),
  TicketController.downloadPdf,
);

router.post(
  "/check-in/qr",
  auth(UserRole.ORGANIZER, UserRole.EVENT_STAFF),
  validateRequest(qrCheckInSchema),
  TicketController.qrCheckIn,
);

router.get(
  "/check-in/event/:eventId/search",
  auth(UserRole.ORGANIZER, UserRole.EVENT_STAFF),
  TicketController.manualSearch,
);

router.post(
  "/check-in/manual",
  auth(UserRole.ORGANIZER, UserRole.EVENT_STAFF),
  validateRequest(manualCheckInSchema),
  TicketController.manualCheckIn,
);

export const TicketRoutes = router;
