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

const formatTicketDate = (value: Date) =>
  `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(value)} UTC`;

const generatePdf = async (userId: string, ticketId: string) => {
  const ticket = await getMyTicket(userId, ticketId);
  const qr = await QRCode.toBuffer(ticket.qrPayload, {
    type: "png",
    width: 420,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  const doc = new PDFDocument({
    size: "A4",
    margin: 0,
    info: {
      Title: `EventFlow Ticket - ${ticket.event.title}`,
      Subject: `Digital ticket ${ticket.ticketNumber}`,
      Author: "EventFlow",
      Creator: "EventFlow",
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  const ready = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const cardX = 34;
  const cardY = 32;
  const cardW = pageWidth - 68;
  const cardH = pageHeight - 64;
  const contentX = cardX + 34;
  const accent = "#5B5CF6";
  const ink = "#0F172A";
  const muted = "#64748B";
  const soft = "#F8FAFC";
  const border = "#E2E8F0";

  // Page background + premium ticket shell.
  doc.rect(0, 0, pageWidth, pageHeight).fill("#F1F5F9");
  doc.roundedRect(cardX, cardY, cardW, cardH, 24).fill("#FFFFFF");

  // Header.
  doc.save();
  doc.roundedRect(cardX, cardY, cardW, 170, 24).clip();
  doc.rect(cardX, cardY, cardW, 170).fill("#080D1F");
  doc.rect(cardX, cardY + 164, cardW, 6).fill(accent);
  doc.restore();

  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(19)
    .text("Event", contentX, 57, { continued: true })
    .fillColor("#8B8CFF")
    .text("Flow");

  doc
    .fillColor("#A5B4FC")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("SECURE DIGITAL ADMISSION", contentX, 86, {
      characterSpacing: 1.7,
    });

  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(24)
    .text(ticket.event.title, contentX, 108, {
      width: 330,
      height: 58,
      ellipsis: true,
      lineGap: 2,
    });

  const status = String(ticket.status).toUpperCase();
  const statusFill =
    status === "VALID"
      ? "#DCFCE7"
      : status === "CHECKED_IN"
        ? "#DBEAFE"
        : "#FEF3C7";
  const statusText =
    status === "VALID"
      ? "#15803D"
      : status === "CHECKED_IN"
        ? "#1D4ED8"
        : "#92400E";

  doc
    .roundedRect(cardX + cardW - 120, 57, 82, 28, 14)
    .fill(statusFill)
    .fillColor(statusText)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(status, cardX + cardW - 120, 66, {
      width: 82,
      align: "center",
    });

  doc
    .fillColor("#CBD5E1")
    .font("Helvetica")
    .fontSize(8)
    .text("TICKET VALUE", cardX + cardW - 164, 111, {
      width: 126,
      align: "right",
      characterSpacing: 1,
    })
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(
      `${ticket.order.currency} ${Number(ticket.ticketType.price).toFixed(2)}`,
      cardX + cardW - 190,
      129,
      { width: 152, align: "right" },
    );

  // Ticket meta strip.
  const metaY = 224;
  const metaW = (cardW - 68) / 3;
  const meta = [
    ["TICKET TYPE", ticket.ticketType.name],
    ["EVENT START", formatTicketDate(ticket.event.startDateTime)],
    ["VENUE", ticket.event.venueName],
  ] as const;

  meta.forEach(([label, value], index) => {
    const x = contentX + index * metaW;
    if (index > 0) {
      doc
        .moveTo(x - 12, metaY)
        .lineTo(x - 12, metaY + 58)
        .strokeColor(border)
        .lineWidth(1)
        .stroke();
    }

    doc
      .fillColor(muted)
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .text(label, x, metaY, {
        width: metaW - 24,
        characterSpacing: 1.1,
      })
      .fillColor(ink)
      .font("Helvetica-Bold")
      .fontSize(10.5)
      .text(value, x, metaY + 18, {
        width: metaW - 24,
        height: 36,
        ellipsis: true,
      });
  });

  doc
    .moveTo(contentX, 301)
    .lineTo(cardX + cardW - 34, 301)
    .strokeColor(border)
    .lineWidth(1)
    .stroke();

  // Left details panel.
  const detailsX = contentX;
  const detailsY = 333;
  const detailsW = 278;
  const detailsH = 286;

  doc
    .roundedRect(detailsX, detailsY, detailsW, detailsH, 18)
    .fillAndStroke(soft, border);

  doc
    .fillColor(ink)
    .font("Helvetica-Bold")
    .fontSize(13)
    .text("Ticket details", detailsX + 22, detailsY + 22);

  const detailRows = [
    ["Ticket number", ticket.ticketNumber],
    ["Order", ticket.order.orderNumber],
    ["Venue address", ticket.event.venueAddress],
    ["Price", `${ticket.order.currency} ${Number(ticket.ticketType.price).toFixed(2)}`],
    ["Status", status],
  ] as const;

  let rowY = detailsY + 60;
  for (const [label, value] of detailRows) {
    doc
      .fillColor(muted)
      .font("Helvetica-Bold")
      .fontSize(7.5)
      .text(label.toUpperCase(), detailsX + 22, rowY, {
        width: 92,
        characterSpacing: 0.8,
      })
      .fillColor(ink)
      .font(label === "Ticket number" || label === "Order" ? "Courier-Bold" : "Helvetica-Bold")
      .fontSize(label === "Ticket number" || label === "Order" ? 8.8 : 9.5)
      .text(value, detailsX + 118, rowY - 1, {
        width: detailsW - 140,
        height: 32,
        ellipsis: true,
      });

    rowY += label === "Venue address" ? 53 : 41;
  }

  // QR panel.
  const qrX = detailsX + detailsW + 20;
  const qrY = detailsY;
  const qrW = cardX + cardW - 34 - qrX;
  const qrH = detailsH;

  doc
    .roundedRect(qrX, qrY, qrW, qrH, 18)
    .fillAndStroke("#FFFFFF", border);

  doc
    .fillColor(ink)
    .font("Helvetica-Bold")
    .fontSize(13)
    .text("Scan at entry", qrX + 18, qrY + 22, {
      width: qrW - 36,
      align: "center",
    });

  doc
    .fillColor(muted)
    .font("Helvetica")
    .fontSize(8.5)
    .text("Present this QR code to event staff.", qrX + 18, qrY + 44, {
      width: qrW - 36,
      align: "center",
    });

  const qrSize = Math.min(158, qrW - 42);
  const qrImageX = qrX + (qrW - qrSize) / 2;
  const qrImageY = qrY + 77;

  doc
    .roundedRect(qrImageX - 10, qrImageY - 10, qrSize + 20, qrSize + 20, 14)
    .fillAndStroke("#FFFFFF", "#CBD5E1");
  doc.image(qr, qrImageX, qrImageY, {
    fit: [qrSize, qrSize],
    align: "center",
  });

  doc
    .fillColor("#475569")
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .text("ONE-TIME ENTRY CODE", qrX + 18, qrY + 252, {
      width: qrW - 36,
      align: "center",
      characterSpacing: 1.05,
    });

  // Guidance / security strip.
  const guideY = 647;
  doc
    .roundedRect(contentX, guideY, cardW - 68, 76, 16)
    .fill("#EEF2FF");

  doc
    .fillColor(accent)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("KEEP THIS TICKET PRIVATE", contentX + 20, guideY + 17, {
      characterSpacing: 0.9,
    });

  doc
    .fillColor("#3730A3")
    .font("Helvetica")
    .fontSize(9)
    .text(
      "Do not post or share the QR code. It is cryptographically signed and becomes unusable after successful check-in.",
      contentX + 20,
      guideY + 36,
      { width: cardW - 108, lineGap: 2 },
    );

  // Footer.
  const footerY = cardY + cardH - 67;
  doc
    .moveTo(contentX, footerY - 14)
    .lineTo(cardX + cardW - 34, footerY - 14)
    .strokeColor(border)
    .lineWidth(1)
    .stroke();

  doc
    .fillColor("#94A3B8")
    .font("Helvetica")
    .fontSize(7.5)
    .text("Issued securely by EventFlow", contentX, footerY, {
      width: 180,
    });

  doc
    .fillColor("#94A3B8")
    .font("Courier")
    .fontSize(7.2)
    .text(ticket.ticketNumber, cardX + cardW - 220, footerY, {
      width: 186,
      align: "right",
    });

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
