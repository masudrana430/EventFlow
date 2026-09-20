import httpStatus from "http-status";
import {
  OrderStatus,
  RefundPolicyType,
  RefundStatus,
  TicketStatus,
  UserRole,
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

const refundableAmount = (
  event: {
    startDateTime: Date;
    refundPolicyType: RefundPolicyType;
    refundDeadline: Date | null;
    refundPercentage: number | null;
  },
  ticketPrice: number,
) => {
  const hours = (event.startDateTime.getTime() - Date.now()) / 3_600_000;
  if (hours <= 0) return 0;

  if (event.refundPolicyType === RefundPolicyType.NON_REFUNDABLE) return 0;

  if (
    event.refundPolicyType === RefundPolicyType.FULL_UNTIL &&
    event.refundDeadline
  ) {
    return new Date() <= event.refundDeadline ? ticketPrice : 0;
  }

  if (
    event.refundPolicyType === RefundPolicyType.PARTIAL_UNTIL &&
    event.refundDeadline
  ) {
    return new Date() <= event.refundDeadline
      ? ticketPrice * ((event.refundPercentage ?? 50) / 100)
      : 0;
  }

  if (event.refundPolicyType === RefundPolicyType.ORGANIZER_APPROVAL) {
    return ticketPrice;
  }

  if (hours > 72) return ticketPrice;
  if (hours >= 24) return ticketPrice * 0.5;
  return 0;
};

const request = async (
  userId: string,
  payload: { ticketId: string; reason: string },
) => {
  const attendee = await getAttendee(userId);
  const ticket = await prisma.ticket.findFirst({
    where: { id: payload.ticketId, ownerId: attendee.id },
    include: {
      event: true,
      ticketType: true,
      order: true,
      refunds: true,
    },
  });

  if (!ticket) throw new AppError(httpStatus.NOT_FOUND, "Ticket not found");
  if (ticket.status !== TicketStatus.VALID) {
    throw new AppError(httpStatus.CONFLICT, "Only valid unused tickets can be refunded");
  }
  if (
    ticket.refunds.some(
      (refund) =>
        refund.status === RefundStatus.REQUESTED ||
        refund.status === RefundStatus.APPROVED ||
        refund.status === RefundStatus.PROCESSING,
    )
  ) {
    throw new AppError(httpStatus.CONFLICT, "A refund request is already active");
  }

  const amount = refundableAmount(ticket.event, Number(ticket.ticketType.price));
  if (amount <= 0 && ticket.event.refundPolicyType !== RefundPolicyType.ORGANIZER_APPROVAL) {
    throw new AppError(httpStatus.CONFLICT, "This ticket is not refundable now");
  }

  return prisma.refund.create({
    data: {
      orderId: ticket.orderId,
      ticketId: ticket.id,
      eventId: ticket.eventId,
      attendeeId: attendee.id,
      reason: payload.reason,
      requestedAmount: amount || Number(ticket.ticketType.price),
    },
  });
};

const listForOrganizer = async (userId: string, eventId?: string) => {
  const organizer = await prisma.organizer.findUnique({ where: { userId } });
  if (!organizer) throw new AppError(httpStatus.FORBIDDEN, "Organizer required");

  return prisma.refund.findMany({
    where: {
      ...(eventId ? { eventId } : {}),
      order: { event: { organizerId: organizer.id } },
    },
    include: {
      order: true,
      ticket: { include: { ticketType: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

const listAll = async () =>
  prisma.refund.findMany({
    include: {
      order: { include: { event: true } },
      ticket: { include: { ticketType: true } },
    },
    orderBy: { createdAt: "desc" },
  });

const decide = async (
  actor: { userId: string; role: UserRole },
  refundId: string,
  decision: "APPROVED" | "REJECTED",
  approvedAmount?: number,
  reason?: string,
) => {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: { order: { include: { event: true } } },
  });
  if (!refund) throw new AppError(httpStatus.NOT_FOUND, "Refund request not found");
  if (refund.status !== RefundStatus.REQUESTED) {
    throw new AppError(httpStatus.CONFLICT, "Refund request is already reviewed");
  }

  if (actor.role === UserRole.ORGANIZER) {
    const organizer = await prisma.organizer.findUnique({
      where: { userId: actor.userId },
    });
    if (!organizer || refund.order.event.organizerId !== organizer.id) {
      throw new AppError(httpStatus.FORBIDDEN, "You cannot review this refund");
    }
  }

  if (decision === "APPROVED" && approvedAmount === undefined) {
    approvedAmount = Number(refund.requestedAmount);
  }
  if (
    approvedAmount !== undefined &&
    approvedAmount > Number(refund.requestedAmount)
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Approved amount cannot exceed requested amount",
    );
  }

  const updated = await prisma.refund.update({
    where: { id: refundId },
    data:
      decision === "APPROVED"
        ? {
            status: RefundStatus.PROCESSING,
            approvedAmount,
            decisionByUserId: actor.userId,
            decisionReason: reason,
          }
        : {
            status: RefundStatus.REJECTED,
            decisionByUserId: actor.userId,
            decisionReason: reason,
          },
  });

  await writeAuditLog({
    actorUserId: actor.userId,
    action: decision === "APPROVED" ? "REFUND_APPROVED" : "REFUND_REJECTED",
    targetType: "Refund",
    targetId: refundId,
    previousValue: { status: refund.status },
    newValue: { status: updated.status, approvedAmount, reason },
  });

  return updated;
};

const markRefunded = async (
  actorUserId: string,
  refundId: string,
  gatewayRefundId: string,
) => {
  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: {
      ticket: true,
      order: { include: { tickets: true } },
    },
  });
  if (!refund) throw new AppError(httpStatus.NOT_FOUND, "Refund not found");
  if (refund.status !== RefundStatus.PROCESSING) {
    throw new AppError(httpStatus.CONFLICT, "Refund is not in processing state");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.refund.update({
      where: { id: refundId },
      data: {
        status: RefundStatus.REFUNDED,
        gatewayRefundId,
        refundedAt: new Date(),
      },
    });

    if (refund.ticketId && refund.ticket) {
      await tx.ticket.update({
        where: { id: refund.ticketId },
        data: { status: TicketStatus.REFUNDED },
      });

      await tx.ticketType.update({
        where: { id: refund.ticket.ticketTypeId },
        data: { soldQuantity: { decrement: 1 } },
      });
    }

    const remainingActive = refund.order.tickets.filter(
      (ticket) =>
        ticket.id !== refund.ticketId &&
        ticket.status !== TicketStatus.REFUNDED &&
        ticket.status !== TicketStatus.CANCELLED &&
        ticket.status !== TicketStatus.VOID,
    ).length;

    await tx.order.update({
      where: { id: refund.orderId },
      data: {
        status:
          remainingActive === 0
            ? OrderStatus.REFUNDED
            : OrderStatus.PARTIALLY_REFUNDED,
      },
    });

    return updated;
  });

  await writeAuditLog({
    actorUserId,
    action: "REFUND_COMPLETED",
    targetType: "Refund",
    targetId: refundId,
    newValue: { gatewayRefundId },
  });

  const user = await prisma.attendee.findUnique({
    where: { id: refund.attendeeId },
  });
  if (user) {
    await createNotification({
      userId: user.userId,
      type: "REFUND_COMPLETED",
      title: "Refund completed",
      message: "Your EventFlow refund has been completed.",
      resourceType: "Refund",
      resourceId: refundId,
    });
  }

  return result;
};

export const RefundService = {
  request,
  listForOrganizer,
  listAll,
  decide,
  markRefunded,
};
