import cron from "node-cron";
import {
  EventStatus,
  PayoutStatus,
  ReservationStatus,
  StaffInvitationStatus,
  TransferStatus,
} from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";

const expireReservations = async () => {
  const expired = await prisma.ticketReservation.findMany({
    where: {
      status: ReservationStatus.ACTIVE,
      expiresAt: { lte: new Date() },
    },
    select: {
      id: true,
      ticketTypeId: true,
      quantity: true,
    },
  });

  for (const reservation of expired) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.ticketReservation.updateMany({
        where: {
          id: reservation.id,
          status: ReservationStatus.ACTIVE,
        },
        data: {
          status: ReservationStatus.EXPIRED,
        },
      });

      if (!updated.count) return;

      await tx.ticketType.update({
        where: { id: reservation.ticketTypeId },
        data: {
          reservedQuantity: { decrement: reservation.quantity },
        },
      });

      await tx.order.updateMany({
        where: {
          reservationId: reservation.id,
          status: "PENDING",
        },
        data: {
          status: "EXPIRED",
        },
      });
    });
  }
};

const updateEventLifecycle = async () => {
  const now = new Date();

  await prisma.event.updateMany({
    where: {
      status: EventStatus.APPROVED,
      publishAt: { lte: now },
    },
    data: {
      status: EventStatus.PUBLISHED,
      publishedAt: now,
    },
  });

  await prisma.event.updateMany({
    where: {
      status: EventStatus.PUBLISHED,
      startDateTime: { lte: now },
    },
    data: {
      status: EventStatus.ONGOING,
    },
  });

  await prisma.event.updateMany({
    where: {
      status: EventStatus.ONGOING,
      endDateTime: { lte: now },
    },
    data: {
      status: EventStatus.COMPLETED,
      completedAt: now,
    },
  });
};

const expireInvitations = async () => {
  const now = new Date();

  await prisma.eventStaff.updateMany({
    where: {
      invitationStatus: StaffInvitationStatus.PENDING,
      invitationExpiresAt: { lte: now },
    },
    data: {
      invitationStatus: StaffInvitationStatus.EXPIRED,
    },
  });

  await prisma.ticketTransfer.updateMany({
    where: {
      status: TransferStatus.PENDING,
      expiresAt: { lte: now },
    },
    data: {
      status: TransferStatus.EXPIRED,
    },
  });
};

const offerWaitlistInventory = async () => {
  const waiting = await prisma.waitlistEntry.findMany({
    where: {
      status: "WAITING",
      ticketType: {
        isDeleted: false,
        isVisible: true,
      },
    },
    include: {
      attendee: true,
      ticketType: true,
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  const offeredTypes = new Set<string>();

  for (const entry of waiting) {
    if (offeredTypes.has(entry.ticketTypeId)) continue;

    const available =
      entry.ticketType.quantity -
      entry.ticketType.soldQuantity -
      entry.ticketType.reservedQuantity;

    if (available <= 0) continue;

    const offeredAt = new Date();
    const offerExpiresAt = new Date(offeredAt.getTime() + 15 * 60 * 1000);

    const updated = await prisma.waitlistEntry.updateMany({
      where: {
        id: entry.id,
        status: "WAITING",
      },
      data: {
        status: "OFFERED",
        offeredAt,
        offerExpiresAt,
      },
    });

    if (updated.count) {
      offeredTypes.add(entry.ticketTypeId);
      await prisma.notification.create({
        data: {
          userId: entry.attendee.userId,
          type: "WAITLIST_OFFER",
          title: "Ticket inventory is available",
          message:
            "A ticket became available. Complete checkout soon before someone else buys it.",
          resourceType: "TicketType",
          resourceId: entry.ticketTypeId,
        },
      });
    }
  }

  await prisma.waitlistEntry.updateMany({
    where: {
      status: "OFFERED",
      offerExpiresAt: { lte: new Date() },
    },
    data: {
      status: "EXPIRED",
    },
  });
};

const releaseEligiblePayouts = async () => {
  const cutoff = new Date(
    Date.now() - config.payout_hold_days * 24 * 60 * 60 * 1000,
  );

  await prisma.payout.updateMany({
    where: {
      status: PayoutStatus.PENDING,
      event: {
        status: EventStatus.COMPLETED,
        completedAt: { lte: cutoff },
        disputes: {
          none: {
            status: {
              in: ["OPEN", "ORGANIZER_RESPONDED", "UNDER_REVIEW"],
            },
          },
        },
      },
    },
    data: {
      status: PayoutStatus.ELIGIBLE,
    },
  });
};

export const startBackgroundJobs = () => {
  cron.schedule("* * * * *", async () => {
    try {
      await expireReservations();
      await updateEventLifecycle();
      await expireInvitations();
      await offerWaitlistInventory();
      await releaseEligiblePayouts();
    } catch (error) {
      console.error("Background job failed:", error);
    }
  });
};
