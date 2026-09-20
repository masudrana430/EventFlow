import httpStatus from "http-status";
import {
  DisputeStatus,
  EventStatus,
  PayoutStatus,
  RefundStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { writeAuditLog } from "../../utils/audit";
import { createNotification } from "../../utils/notification";

const getOrganizer = async (userId: string) => {
  const organizer = await prisma.organizer.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!organizer) throw new AppError(httpStatus.FORBIDDEN, "Organizer required");
  return organizer;
};

const calculate = async (organizerId: string, eventId: string) => {
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizerId },
  });
  if (!event) throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  if (event.status !== EventStatus.COMPLETED || !event.completedAt) {
    throw new AppError(httpStatus.CONFLICT, "Event is not completed");
  }

  const eligibleAt = new Date(
    event.completedAt.getTime() + config.payout_hold_days * 24 * 60 * 60 * 1000,
  );
  if (new Date() < eligibleAt) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Payout is held until ${eligibleAt.toISOString()}`,
    );
  }

  const openDisputes = await prisma.dispute.count({
    where: {
      eventId,
      status: {
        in: [
          DisputeStatus.OPEN,
          DisputeStatus.ORGANIZER_RESPONDED,
          DisputeStatus.UNDER_REVIEW,
        ],
      },
    },
  });
  if (openDisputes) {
    throw new AppError(httpStatus.CONFLICT, "Open disputes are blocking this payout");
  }

  const paidOrders = await prisma.order.aggregate({
    where: {
      eventId,
      status: {
        in: ["PAID", "COMPLETED", "PARTIALLY_REFUNDED", "REFUNDED"],
      },
    },
    _sum: { total: true },
  });

  const refunds = await prisma.refund.aggregate({
    where: { eventId, status: RefundStatus.REFUNDED },
    _sum: { approvedAmount: true },
  });

  const grossRevenue = Number(paidOrders._sum.total ?? 0);
  const refundAmount = Number(refunds._sum.approvedAmount ?? 0);
  const platformCommission = Number(
    (grossRevenue * (config.platform_commission_percent / 100)).toFixed(2),
  );
  const gatewayFees = 0;
  const adjustments = 0;
  const netAmount = Math.max(
    0,
    Number(
      (
        grossRevenue -
        refundAmount -
        gatewayFees -
        platformCommission +
        adjustments
      ).toFixed(2),
    ),
  );

  return {
    event,
    grossRevenue,
    refundAmount,
    gatewayFees,
    platformCommission,
    adjustments,
    netAmount,
  };
};

const request = async (userId: string, eventId: string) => {
  const organizer = await getOrganizer(userId);
  const calculated = await calculate(organizer.id, eventId);

  const existing = await prisma.payout.findUnique({ where: { eventId } });
  if (
    existing &&
    ![PayoutStatus.PENDING, PayoutStatus.ELIGIBLE, PayoutStatus.FAILED].includes(
      existing.status,
    )
  ) {
    throw new AppError(httpStatus.CONFLICT, "Payout is already being processed");
  }

  return prisma.payout.upsert({
    where: { eventId },
    create: {
      organizerId: organizer.id,
      eventId,
      grossRevenue: calculated.grossRevenue,
      refundAmount: calculated.refundAmount,
      gatewayFees: calculated.gatewayFees,
      platformCommission: calculated.platformCommission,
      adjustments: calculated.adjustments,
      netAmount: calculated.netAmount,
      status: PayoutStatus.REQUESTED,
      requestedAt: new Date(),
    },
    update: {
      grossRevenue: calculated.grossRevenue,
      refundAmount: calculated.refundAmount,
      gatewayFees: calculated.gatewayFees,
      platformCommission: calculated.platformCommission,
      adjustments: calculated.adjustments,
      netAmount: calculated.netAmount,
      status: PayoutStatus.REQUESTED,
      requestedAt: new Date(),
      holdReason: null,
    },
  });
};

const mine = async (userId: string) => {
  const organizer = await getOrganizer(userId);
  return prisma.payout.findMany({
    where: { organizerId: organizer.id },
    include: { event: true },
    orderBy: { createdAt: "desc" },
  });
};

const all = () =>
  prisma.payout.findMany({
    include: {
      event: true,
      organizer: { include: { user: { omit: { password: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

const decide = async (
  actorUserId: string,
  payoutId: string,
  payload: {
    status: PayoutStatus;
    paymentReference?: string;
    holdReason?: string;
  },
) => {
  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { organizer: true },
  });
  if (!payout) throw new AppError(httpStatus.NOT_FOUND, "Payout not found");

  if (
    payload.status === PayoutStatus.PAID &&
    !payload.paymentReference
  ) {
    throw new AppError(httpStatus.BAD_REQUEST, "Payment reference is required");
  }
  if (payload.status === PayoutStatus.HELD && !payload.holdReason) {
    throw new AppError(httpStatus.BAD_REQUEST, "Hold reason is required");
  }

  const updated = await prisma.payout.update({
    where: { id: payoutId },
    data: {
      status: payload.status,
      paymentReference: payload.paymentReference,
      holdReason: payload.holdReason,
      processedAt:
        payload.status === PayoutStatus.PROCESSING ? new Date() : payout.processedAt,
      paidAt: payload.status === PayoutStatus.PAID ? new Date() : payout.paidAt,
    },
  });

  await writeAuditLog({
    actorUserId,
    action: "PAYOUT_STATUS_UPDATED",
    targetType: "Payout",
    targetId: payoutId,
    previousValue: { status: payout.status },
    newValue: payload,
  });

  await createNotification({
    userId: payout.organizer.userId,
    type: "PAYOUT_UPDATED",
    title: "Payout status updated",
    message: `Your payout is now ${payload.status.toLowerCase()}.`,
    resourceType: "Payout",
    resourceId: payoutId,
  });

  return updated;
};

export const PayoutService = { request, mine, all, decide };
