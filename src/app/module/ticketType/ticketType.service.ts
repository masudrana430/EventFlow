import httpStatus from "http-status";
import { EventStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { EventService } from "../event/event.service";

const create = async (
  userId: string,
  eventId: string,
  payload: {
    name: string;
    description?: string;
    price: number;
    quantity: number;
    maxPerOrder: number;
    saleStartAt: string;
    saleEndAt: string;
    transferable: boolean;
    refundable: boolean;
    benefits: string[];
    isVisible: boolean;
  },
) => {
  const event = await EventService.getOwnedEvent(userId, eventId);

  if (
    event.status !== EventStatus.DRAFT &&
    event.status !== EventStatus.CHANGES_REQUESTED &&
    event.status !== EventStatus.REJECTED &&
    event.status !== EventStatus.APPROVED
  ) {
    throw new AppError(httpStatus.CONFLICT, "Ticket types cannot be added now");
  }

  const saleStartAt = new Date(payload.saleStartAt);
  const saleEndAt = new Date(payload.saleEndAt);

  if (saleEndAt <= saleStartAt) {
    throw new AppError(httpStatus.BAD_REQUEST, "Ticket sale end must be after start");
  }
  if (saleStartAt < event.saleStartAt || saleEndAt > event.saleEndAt) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Ticket sale period must stay inside the event sale period",
    );
  }

  const existingInventory = event.ticketTypes.reduce(
    (sum, type) => sum + type.quantity,
    0,
  );

  if (existingInventory + payload.quantity > event.capacity) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Combined ticket inventory exceeds venue capacity",
    );
  }

  return prisma.ticketType.create({
    data: {
      eventId,
      ...payload,
      saleStartAt,
      saleEndAt,
    },
  });
};

const update = async (
  userId: string,
  ticketTypeId: string,
  payload: Record<string, unknown>,
) => {
  const type = await prisma.ticketType.findUnique({
    where: { id: ticketTypeId },
    include: { event: true },
  });
  if (!type) throw new AppError(httpStatus.NOT_FOUND, "Ticket type not found");

  await EventService.getOwnedEvent(userId, type.eventId);

  if (type.soldQuantity > 0 && "price" in payload) {
    throw new AppError(httpStatus.CONFLICT, "Ticket price is locked after the first sale");
  }

  if (typeof payload.quantity === "number") {
    if (payload.quantity < type.soldQuantity + type.reservedQuantity) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Quantity cannot be lower than sold plus reserved inventory",
      );
    }

    const others = await prisma.ticketType.aggregate({
      where: {
        eventId: type.eventId,
        id: { not: type.id },
        isDeleted: false,
      },
      _sum: { quantity: true },
    });

    if ((others._sum.quantity ?? 0) + payload.quantity > type.event.capacity) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Combined ticket inventory exceeds venue capacity",
      );
    }
  }

  return prisma.ticketType.update({
    where: { id: ticketTypeId },
    data: {
      ...payload,
      ...("saleStartAt" in payload
        ? { saleStartAt: new Date(payload.saleStartAt as string) }
        : {}),
      ...("saleEndAt" in payload
        ? { saleEndAt: new Date(payload.saleEndAt as string) }
        : {}),
    },
  });
};

const remove = async (userId: string, ticketTypeId: string) => {
  const type = await prisma.ticketType.findUnique({ where: { id: ticketTypeId } });
  if (!type) throw new AppError(httpStatus.NOT_FOUND, "Ticket type not found");

  await EventService.getOwnedEvent(userId, type.eventId);

  if (type.soldQuantity > 0 || type.reservedQuantity > 0) {
    return prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: { isDeleted: true, isVisible: false },
    });
  }

  await prisma.ticketType.delete({ where: { id: ticketTypeId } });
  return null;
};

const listPublic = (eventId: string) =>
  prisma.ticketType.findMany({
    where: {
      eventId,
      isDeleted: false,
      isVisible: true,
      event: { status: EventStatus.PUBLISHED },
    },
    orderBy: { price: "asc" },
  });

export const TicketTypeService = {
  create,
  update,
  remove,
  listPublic,
};
