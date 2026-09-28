import httpStatus from "http-status";
import { EventStatus, WaitlistStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

const getAttendee = async (userId: string) => {
  const attendee = await prisma.attendee.findUnique({ where: { userId } });
  if (!attendee) throw new AppError(httpStatus.FORBIDDEN, "Attendee required");
  return attendee;
};

const join = async (userId: string, ticketTypeId: string) => {
  const attendee = await getAttendee(userId);
  const type = await prisma.ticketType.findUnique({
    where: { id: ticketTypeId },
    include: { event: true },
  });

  if (!type || type.event.status !== EventStatus.PUBLISHED || type.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, "Ticket type is unavailable");
  }

  const available = type.quantity - type.soldQuantity - type.reservedQuantity;
  if (available > 0) {
    throw new AppError(httpStatus.CONFLICT, "Tickets are still available; checkout directly");
  }

  return prisma.waitlistEntry.upsert({
    where: {
      attendeeId_ticketTypeId: {
        attendeeId: attendee.id,
        ticketTypeId,
      },
    },
    create: {
      attendeeId: attendee.id,
      eventId: type.eventId,
      ticketTypeId,
    },
    update: {
      status: WaitlistStatus.WAITING,
      offeredAt: null,
      offerExpiresAt: null,
    },
  });
};

const leave = async (userId: string, ticketTypeId: string) => {
  const attendee = await getAttendee(userId);
  const entry = await prisma.waitlistEntry.findUnique({
    where: {
      attendeeId_ticketTypeId: {
        attendeeId: attendee.id,
        ticketTypeId,
      },
    },
  });
  if (!entry) throw new AppError(httpStatus.NOT_FOUND, "Waitlist entry not found");

  return prisma.waitlistEntry.update({
    where: { id: entry.id },
    data: { status: WaitlistStatus.CANCELLED },
  });
};

const mine = async (userId: string) => {
  const attendee = await getAttendee(userId);
  return prisma.waitlistEntry.findMany({
    where: { attendeeId: attendee.id },
    include: { event: true, ticketType: true },
    orderBy: { createdAt: "desc" },
  });
};

export const WaitlistService = { join, leave, mine };
