import httpStatus from "http-status";
import {
  DisputeStatus,
  RefundStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { writeAuditLog } from "../../utils/audit";
import { createNotification } from "../../utils/notification";

const getAttendee = async (userId: string) => {
  const attendee = await prisma.attendee.findUnique({ where: { userId } });
  if (!attendee) throw new AppError(httpStatus.FORBIDDEN, "Attendee required");
  return attendee;
};

const create = async (
  userId: string,
  payload: {
    orderId: string;
    ticketId?: string;
    reason: string;
    description: string;
    evidenceUrls: string[];
  },
) => {
  const attendee = await getAttendee(userId);
  const order = await prisma.order.findFirst({
    where: { id: payload.orderId, attendeeId: attendee.id },
    include: { event: true },
  });
  if (!order) throw new AppError(httpStatus.NOT_FOUND, "Order not found");

  const latest = new Date(order.event.endDateTime.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (new Date() > latest) {
    throw new AppError(httpStatus.CONFLICT, "Dispute window has closed");
  }

  if (payload.ticketId) {
    const ticket = await prisma.ticket.findFirst({
      where: {
        id: payload.ticketId,
        orderId: order.id,
        ownerId: attendee.id,
      },
    });
    if (!ticket) throw new AppError(httpStatus.BAD_REQUEST, "Ticket does not belong to this order");
  }

  return prisma.dispute.create({
    data: {
      attendeeId: attendee.id,
      eventId: order.eventId,
      orderId: order.id,
      ticketId: payload.ticketId,
      organizerId: order.event.organizerId,
      reason: payload.reason,
      description: payload.description,
      evidenceUrls: payload.evidenceUrls,
    },
  });
};

const myDisputes = async (userId: string) => {
  const attendee = await getAttendee(userId);
  return prisma.dispute.findMany({
    where: { attendeeId: attendee.id },
    include: { event: true, order: true, messages: true },
    orderBy: { createdAt: "desc" },
  });
};

const organizerList = async (userId: string) => {
  const organizer = await prisma.organizer.findUnique({ where: { userId } });
  if (!organizer) throw new AppError(httpStatus.FORBIDDEN, "Organizer required");

  return prisma.dispute.findMany({
    where: { organizerId: organizer.id },
    include: { event: true, order: true, messages: true },
    orderBy: { createdAt: "desc" },
  });
};

const organizerRespond = async (
  userId: string,
  disputeId: string,
  response: string,
) => {
  const organizer = await prisma.organizer.findUnique({ where: { userId } });
  if (!organizer) throw new AppError(httpStatus.FORBIDDEN, "Organizer required");

  const dispute = await prisma.dispute.findFirst({
    where: { id: disputeId, organizerId: organizer.id },
  });
  if (!dispute) throw new AppError(httpStatus.NOT_FOUND, "Dispute not found");

  return prisma.$transaction(async (tx) => {
    await tx.disputeMessage.create({
      data: { disputeId, senderUserId: userId, message: response },
    });
    return tx.dispute.update({
      where: { id: disputeId },
      data: {
        organizerResponse: response,
        status: DisputeStatus.ORGANIZER_RESPONDED,
      },
    });
  });
};

const adminList = () =>
  prisma.dispute.findMany({
    include: {
      event: true,
      order: true,
      ticket: true,
      attendee: { include: { user: { omit: { password: true } } } },
      messages: true,
    },
    orderBy: { createdAt: "desc" },
  });

const decide = async (
  actorUserId: string,
  disputeId: string,
  payload: {
    decision: "REJECT" | "PARTIAL_REFUND" | "FULL_REFUND" | "WARNING";
    refundAmount?: number;
    note: string;
  },
) => {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      order: true,
      ticket: { include: { ticketType: true } },
      attendee: true,
    },
  });
  if (!dispute) throw new AppError(httpStatus.NOT_FOUND, "Dispute not found");

  const refundAmount =
    payload.decision === "FULL_REFUND"
      ? dispute.ticket
        ? Number(dispute.ticket.ticketType.price)
        : Number(dispute.order.total)
      : payload.decision === "PARTIAL_REFUND"
        ? payload.refundAmount
        : undefined;

  if (payload.decision === "PARTIAL_REFUND" && !refundAmount) {
    throw new AppError(httpStatus.BAD_REQUEST, "Partial refund amount is required");
  }

  const result = await prisma.$transaction(async (tx) => {
    if (refundAmount && refundAmount > 0) {
      await tx.refund.create({
        data: {
          orderId: dispute.orderId,
          ticketId: dispute.ticketId,
          eventId: dispute.eventId,
          attendeeId: dispute.attendeeId,
          reason: `Dispute resolution: ${payload.note}`,
          requestedAmount: refundAmount,
          approvedAmount: refundAmount,
          status: RefundStatus.PROCESSING,
          decisionByUserId: actorUserId,
          decisionReason: payload.note,
        },
      });
    }

    return tx.dispute.update({
      where: { id: disputeId },
      data: {
        status:
          payload.decision === "REJECT"
            ? DisputeStatus.REJECTED
            : DisputeStatus.RESOLVED,
        adminDecision: `${payload.decision}: ${payload.note}`,
        decisionByUserId: actorUserId,
        resolvedAt: new Date(),
      },
    });
  });

  await writeAuditLog({
    actorUserId,
    action: "DISPUTE_DECIDED",
    targetType: "Dispute",
    targetId: disputeId,
    newValue: payload,
  });

  await createNotification({
    userId: dispute.attendee.userId,
    type: "DISPUTE_UPDATED",
    title: "Your EventFlow dispute was reviewed",
    message: payload.note,
    resourceType: "Dispute",
    resourceId: disputeId,
  });

  return result;
};

export const DisputeService = {
  create,
  myDisputes,
  organizerList,
  organizerRespond,
  adminList,
  decide,
};
