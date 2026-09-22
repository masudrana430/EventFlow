import crypto from "node:crypto";
import httpStatus from "http-status";
import {
  RefundStatus,
  TicketStatus,
  TransferStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { safeSendEmail } from "../../utils/email";
import { renderTransactionalEmail } from "../../utils/emailTemplates";
import {
  randomToken,
  sha256,
  signTicketPayload,
  ticketNumber,
} from "../../utils/security";

const getAttendee = async (userId: string) => {
  const attendee = await prisma.attendee.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!attendee) throw new AppError(httpStatus.FORBIDDEN, "Attendee required");
  return attendee;
};

const create = async (
  userId: string,
  ticketId: string,
  recipientEmail: string,
) => {
  const attendee = await getAttendee(userId);
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, ownerId: attendee.id },
    include: {
      ticketType: true,
      event: true,
      refunds: true,
    },
  });

  if (!ticket) throw new AppError(httpStatus.NOT_FOUND, "Ticket not found");
  if (!ticket.ticketType.transferable) {
    throw new AppError(httpStatus.CONFLICT, "This ticket type is not transferable");
  }
  if (ticket.status !== TicketStatus.VALID || ticket.event.startDateTime <= new Date()) {
    throw new AppError(httpStatus.CONFLICT, "Ticket can no longer be transferred");
  }
  if (
    ticket.refunds.some(
      (refund) =>
        refund.status === RefundStatus.REQUESTED ||
        refund.status === RefundStatus.APPROVED ||
        refund.status === RefundStatus.PROCESSING,
    )
  ) {
    throw new AppError(httpStatus.CONFLICT, "Ticket has an active refund request");
  }
  if (recipientEmail === attendee.user.email) {
    throw new AppError(httpStatus.BAD_REQUEST, "Recipient must be another attendee");
  }

  const token = randomToken();
  const transfer = await prisma.ticketTransfer.create({
    data: {
      ticketId,
      senderAttendeeId: attendee.id,
      recipientEmail,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });

  void safeSendEmail({
    to: recipientEmail,
    subject: "EventFlow ticket transfer invitation",
    html: await renderTransactionalEmail({
      name: "EventFlow attendee",
      heading: "A ticket is waiting for you",
      message:
        "Someone has invited you to receive an EventFlow ticket transfer. Sign in with the recipient email address and use the transfer token below to accept it.",
      preheader: `Ticket transfer invitation for ${ticket.event.title}.`,
      badge: "Ticket transfer",
      tone: "info",
      details: [
        { label: "Event", value: ticket.event.title },
        { label: "Ticket type", value: ticket.ticketType.name },
        { label: "Transfer token", value: token, code: true },
        { label: "Expires", value: "48 hours" },
      ],
      highlightTitle: "Use the intended recipient account",
      highlightText:
        "For security, the transfer can only be accepted by an EventFlow attendee signed in with the recipient email address.",
    }),
  });

  return { transfer, token };
};

const accept = async (userId: string, token: string) => {
  const attendee = await getAttendee(userId);
  const transfer = await prisma.ticketTransfer.findUnique({
    where: { tokenHash: sha256(token) },
    include: { ticket: true },
  });

  if (
    !transfer ||
    transfer.status !== TransferStatus.PENDING ||
    transfer.expiresAt <= new Date()
  ) {
    throw new AppError(httpStatus.BAD_REQUEST, "Transfer invitation is invalid or expired");
  }
  if (transfer.recipientEmail !== attendee.user.email) {
    throw new AppError(httpStatus.FORBIDDEN, "This transfer invitation belongs to another email");
  }
  if (transfer.ticket.status !== TicketStatus.VALID) {
    throw new AppError(httpStatus.CONFLICT, "Original ticket is no longer valid");
  }

  const newId = crypto.randomUUID();
  const qrPayload = signTicketPayload(newId, transfer.ticket.eventId);
  const newTicketNumber = ticketNumber();

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.ticket.updateMany({
      where: { id: transfer.ticketId, status: TicketStatus.VALID },
      data: { status: TicketStatus.TRANSFERRED },
    });
    if (!claimed.count) {
      throw new AppError(httpStatus.CONFLICT, "Original ticket is no longer transferable");
    }

    const replacement = await tx.ticket.create({
      data: {
        id: newId,
        ticketNumber: newTicketNumber,
        orderId: transfer.ticket.orderId,
        eventId: transfer.ticket.eventId,
        ticketTypeId: transfer.ticket.ticketTypeId,
        ownerId: attendee.id,
        qrPayload,
        qrTokenHash: sha256(qrPayload),
      },
    });

    await tx.ticketTransfer.update({
      where: { id: transfer.id },
      data: {
        status: TransferStatus.ACCEPTED,
        acceptedAt: new Date(),
        recipientAttendeeId: attendee.id,
        replacementTicket: newTicketNumber,
      },
    });

    return replacement;
  });
};

const myTransfers = async (userId: string) => {
  const attendee = await getAttendee(userId);
  return prisma.ticketTransfer.findMany({
    where: {
      OR: [
        { senderAttendeeId: attendee.id },
        { recipientEmail: attendee.user.email },
      ],
    },
    include: {
      ticket: { include: { event: true, ticketType: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const TransferService = { create, accept, myTransfers };
