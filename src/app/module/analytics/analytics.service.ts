import httpStatus from "http-status";
import {
  EventStatus,
  OrderStatus,
  TicketStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

const moneyMap = (
  rows: Array<{ currency: string; _sum: Record<string, unknown> }>,
  field: string,
) =>
  Object.fromEntries(
    rows.map((row) => [
      row.currency,
      Number((row._sum[field] as number | null | undefined) ?? 0),
    ]),
  );

const attendee = async (userId: string) => {
  const profile = await prisma.attendee.findUnique({ where: { userId } });
  if (!profile) throw new AppError(httpStatus.FORBIDDEN, "Attendee required");

  const [orders, tickets, spent, upcoming] = await prisma.$transaction([
    prisma.order.count({ where: { attendeeId: profile.id } }),
    prisma.ticket.count({ where: { ownerId: profile.id } }),
    prisma.order.groupBy({
      by: ["currency"],
      where: {
        attendeeId: profile.id,
        status: {
          in: [
            OrderStatus.PAID,
            OrderStatus.COMPLETED,
            OrderStatus.PARTIALLY_REFUNDED,
          ],
        },
      },
      _sum: { total: true },
    }),
    prisma.ticket.count({
      where: {
        ownerId: profile.id,
        status: TicketStatus.VALID,
        event: { startDateTime: { gt: new Date() } },
      },
    }),
  ]);

  return {
    totalOrders: orders,
    totalTickets: tickets,
    amountSpentByCurrency: moneyMap(spent as never, "total"),
    upcomingTickets: upcoming,
  };
};

const organizer = async (userId: string) => {
  const profile = await prisma.organizer.findUnique({ where: { userId } });
  if (!profile) throw new AppError(httpStatus.FORBIDDEN, "Organizer required");

  const [
    totalEvents,
    publishedEvents,
    completedEvents,
    orderStats,
    soldTickets,
    checkedIn,
    refunds,
    payouts,
  ] = await prisma.$transaction([
    prisma.event.count({ where: { organizerId: profile.id } }),
    prisma.event.count({
      where: { organizerId: profile.id, status: EventStatus.PUBLISHED },
    }),
    prisma.event.count({
      where: { organizerId: profile.id, status: EventStatus.COMPLETED },
    }),
    prisma.order.groupBy({
      by: ["currency"],
      where: {
        event: { organizerId: profile.id },
        status: {
          in: [
            OrderStatus.PAID,
            OrderStatus.COMPLETED,
            OrderStatus.PARTIALLY_REFUNDED,
            OrderStatus.REFUNDED,
          ],
        },
      },
      _sum: { total: true },
      _count: { id: true },
    }),
    prisma.ticket.count({ where: { event: { organizerId: profile.id } } }),
    prisma.ticket.count({
      where: {
        event: { organizerId: profile.id },
        status: TicketStatus.CHECKED_IN,
      },
    }),
    prisma.refund.groupBy({
      by: ["currency"],
      where: {
        order: { event: { organizerId: profile.id } },
        status: "REFUNDED",
      },
      _sum: { approvedAmount: true },
    }),
    prisma.payout.findMany({
      where: { organizerId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    totalEvents,
    publishedEvents,
    completedEvents,
    paidOrders: orderStats.reduce((sum, row) => sum + row._count.id, 0),
    grossTicketRevenueByCurrency: moneyMap(orderStats as never, "total"),
    ticketsSold: soldTickets,
    checkedIn,
    checkInRate: soldTickets
      ? Number(((checkedIn / soldTickets) * 100).toFixed(2))
      : 0,
    refundAmountByCurrency: moneyMap(refunds as never, "approvedAmount"),
    payoutHistory: payouts,
  };
};

const staff = async (userId: string) => {
  const profile = await prisma.eventStaff.findUnique({ where: { userId } });
  if (!profile) throw new AppError(httpStatus.FORBIDDEN, "Event staff required");

  const [assignedEvents, checkIns] = await prisma.$transaction([
    prisma.eventStaffAssignment.count({
      where: { eventStaffId: profile.id, isActive: true },
    }),
    prisma.checkIn.count({ where: { scannedByUserId: userId } }),
  ]);

  return { assignedEvents, totalCheckIns: checkIns };
};

const admin = async () => {
  const [
    usersByRole,
    pendingOrganizers,
    activeOrganizers,
    publishedEvents,
    pendingEvents,
    sales,
    refunds,
    openDisputes,
    paidPayouts,
    suspendedEvents,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], _count: { id: true } }),
    prisma.organizer.count({ where: { approvalStatus: "PENDING" } }),
    prisma.organizer.count({ where: { approvalStatus: "APPROVED" } }),
    prisma.event.count({ where: { status: EventStatus.PUBLISHED } }),
    prisma.event.count({ where: { status: EventStatus.PENDING_REVIEW } }),
    prisma.order.groupBy({
      by: ["currency"],
      where: {
        status: {
          in: [
            OrderStatus.PAID,
            OrderStatus.COMPLETED,
            OrderStatus.PARTIALLY_REFUNDED,
            OrderStatus.REFUNDED,
          ],
        },
      },
      _sum: { total: true, serviceFee: true },
      _count: { id: true },
    }),
    prisma.refund.groupBy({
      by: ["currency"],
      where: { status: "REFUNDED" },
      _sum: { approvedAmount: true },
      _count: { id: true },
    }),
    prisma.dispute.count({
      where: { status: { in: ["OPEN", "ORGANIZER_RESPONDED", "UNDER_REVIEW"] } },
    }),
    prisma.payout.groupBy({
      by: ["currency"],
      where: { status: "PAID" },
      _sum: { netAmount: true },
      _count: { id: true },
    }),
    prisma.event.count({ where: { status: EventStatus.SUSPENDED } }),
  ]);

  return {
    usersByRole,
    pendingOrganizers,
    activeOrganizers,
    publishedEvents,
    pendingEventReviews: pendingEvents,
    ticketSalesVolume: sales.reduce((sum, row) => sum + row._count.id, 0),
    grossMerchandiseValueByCurrency: moneyMap(sales as never, "total"),
    platformServiceFeeRevenueByCurrency: moneyMap(sales as never, "serviceFee"),
    refundVolume: refunds.reduce((sum, row) => sum + row._count.id, 0),
    refundAmountByCurrency: moneyMap(refunds as never, "approvedAmount"),
    openDisputes,
    completedPayouts: paidPayouts.reduce((sum, row) => sum + row._count.id, 0),
    payoutAmountByCurrency: moneyMap(paidPayouts as never, "netAmount"),
    suspendedEvents,
  };
};

export const AnalyticsService = { attendee, organizer, staff, admin };
