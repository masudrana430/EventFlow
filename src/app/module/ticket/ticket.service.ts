import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import httpStatus from "http-status";
import {
  CheckInMethod,
  StaffInvitationStatus,
  TicketStatus,
  UserRole,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { writeAuditLog } from "../../utils/audit";
import { sha256, verifyTicketPayload } from "../../utils/security";

const getAttendee = async (userId: string) => {
  const attendee = await prisma.attendee.findUnique({ where: { userId } });
  if (!attendee) throw new AppError(httpStatus.FORBIDDEN, "Attendee account required");
  return attendee;
};

const myTickets = async (userId: string) => {
  const attendee = await getAttendee(userId);
  return prisma.ticket.findMany({
    where: { ownerId: attendee.id },
    include: {
      event: true,
      ticketType: true,
      order: true,
      checkIn: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

const getMyTicket = async (userId: string, ticketId: string) => {
  const attendee = await getAttendee(userId);
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, ownerId: attendee.id },
    include: {
      event: true,
      ticketType: true,
      order: true,
      checkIn: true,
    },
  });
  if (!ticket) throw new AppError(httpStatus.NOT_FOUND, "Ticket not found");
  return ticket;
};

const generatePdf = async (userId: string, ticketId: string) => {
  const ticket = await getMyTicket(userId, ticketId);
  const qr = await QRCode.toBuffer(ticket.qrPayload, {
    type: "png",
    width: 240,
    margin: 2,
  });

  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const ready = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(22).text("EventFlow Digital Ticket", { align: "center" });
  doc.moveDown();
  doc.fontSize(16).text(ticket.event.title, { align: "center" });
  doc.moveDown();
  doc.image(qr, { fit: [220, 220], align: "center" });
  doc.moveDown();
  doc.fontSize(11);
  doc.text(`Ticket Number: ${ticket.ticketNumber}`);
  doc.text(`Ticket Type: ${ticket.ticketType.name}`);
  doc.text(`Order: ${ticket.order.orderNumber}`);
  doc.text(`Venue: ${ticket.event.venueName}`);
  doc.text(`Address: ${ticket.event.venueAddress}`);
  doc.text(`Event Start: ${ticket.event.startDateTime.toISOString()}`);
  doc.text(`Status: ${ticket.status}`);
  doc.end();

  return ready;
};

const authorizeScanner = async (
  userId: string,
  role: UserRole,
  eventId: string,
) => {
  if (role === UserRole.ORGANIZER) {
    const organizer = await prisma.organizer.findUnique({ where: { userId } });
    if (!organizer) throw new AppError(httpStatus.FORBIDDEN, "Organizer required");

    const event = await prisma.event.findFirst({
      where: { id: eventId, organizerId: organizer.id },
    });
    if (!event) throw new AppError(httpStatus.FORBIDDEN, "You do not manage this event");
    return event;
  }

  if (role === UserRole.EVENT_STAFF) {
    const staff = await prisma.eventStaff.findUnique({ where: { userId } });
    if (!staff || staff.invitationStatus !== StaffInvitationStatus.ACCEPTED) {
      throw new AppError(httpStatus.FORBIDDEN, "Event staff account is inactive");
    }

    const assignment = await prisma.eventStaffAssignment.findFirst({
      where: { eventStaffId: staff.id, eventId, isActive: true },
      include: { event: true },
    });
    if (!assignment) {
      throw new AppError(httpStatus.FORBIDDEN, "You are not assigned to this event");
    }
    return assignment.event;
  }

  throw new AppError(httpStatus.FORBIDDEN, "Scanner permission required");
};

const ensureEntryWindow = (event: {
  entryOpenTime: Date;
  endDateTime: Date;
}) => {
  const now = new Date();
  if (now < event.entryOpenTime) {
    throw new AppError(httpStatus.CONFLICT, "Event entry window is not open");
  }
  if (now > event.endDateTime) {
    throw new AppError(httpStatus.CONFLICT, "Event entry window has closed");
  }
};

const checkInTicket = async (
  userId: string,
  role: UserRole,
  eventId: string,
  ticketId: string,
  method: CheckInMethod,
  deviceInfo?: string,
) => {
  const event = await authorizeScanner(userId, role, eventId);
  ensureEntryWindow(event);

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.eventId !== eventId) {
    throw new AppError(httpStatus.BAD_REQUEST, "Ticket does not belong to this event");
  }
  if (ticket.status === TicketStatus.CHECKED_IN) {
    throw new AppError(httpStatus.CONFLICT, "Ticket is already checked in");
  }
  if (ticket.status !== TicketStatus.VALID) {
    throw new AppError(httpStatus.CONFLICT, `Ticket is ${ticket.status.toLowerCase()}`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.ticket.updateMany({
      where: { id: ticket.id, status: TicketStatus.VALID },
      data: {
        status: TicketStatus.CHECKED_IN,
        checkedInAt: new Date(),
      },
    });

    if (!claimed.count) {
      throw new AppError(httpStatus.CONFLICT, "Ticket was already used");
    }

    return tx.checkIn.create({
      data: {
        ticketId: ticket.id,
        eventId,
        scannedByUserId: userId,
        method,
        deviceInfo,
      },
      include: {
        ticket: {
          include: {
            owner: { include: { user: { omit: { password: true } } } },
            ticketType: true,
          },
        },
      },
    });
  });

  if (method === CheckInMethod.MANUAL) {
    await writeAuditLog({
      actorUserId: userId,
      action: "MANUAL_TICKET_CHECK_IN",
      targetType: "Ticket",
      targetId: ticket.id,
      newValue: { eventId },
    });
  }

  return result;
};

const qrCheckIn = async (
  userId: string,
  role: UserRole,
  eventId: string,
  qrPayload: string,
  deviceInfo?: string,
) => {
  const parsed = verifyTicketPayload(qrPayload);
  if (!parsed || parsed.eventId !== eventId) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid QR code");
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: parsed.ticketId },
  });
  if (!ticket || ticket.qrTokenHash !== sha256(qrPayload)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid QR code");
  }

  return checkInTicket(
    userId,
    role,
    eventId,
    ticket.id,
    CheckInMethod.QR,
    deviceInfo,
  );
};

const manualSearch = async (
  userId: string,
  role: UserRole,
  eventId: string,
  search: string,
) => {
  await authorizeScanner(userId, role, eventId);

  return prisma.ticket.findMany({
    where: {
      eventId,
      OR: [
        { ticketNumber: { contains: search, mode: "insensitive" } },
        { order: { orderNumber: { contains: search, mode: "insensitive" } } },
        { owner: { user: { email: { contains: search, mode: "insensitive" } } } },
        { owner: { user: { name: { contains: search, mode: "insensitive" } } } },
      ],
    },
    include: {
      owner: { include: { user: { omit: { password: true } } } },
      ticketType: true,
      order: true,
    },
    take: 20,
  });
};

const manualCheckIn = async (
  userId: string,
  role: UserRole,
  eventId: string,
  ticketId: string,
  deviceInfo?: string,
) =>
  checkInTicket(
    userId,
    role,
    eventId,
    ticketId,
    CheckInMethod.MANUAL,
    deviceInfo,
  );

export const TicketService = {
  myTickets,
  getMyTicket,
  generatePdf,
  qrCheckIn,
  manualSearch,
  manualCheckIn,
};
