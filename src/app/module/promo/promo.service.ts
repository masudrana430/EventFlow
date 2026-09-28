import httpStatus from "http-status";
import { DiscountType } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { EventService } from "../event/event.service";

const create = async (
  userId: string,
  payload: {
    eventId: string;
    code: string;
    discountType: DiscountType;
    value: number;
    maxUses?: number;
    minOrderAmount?: number;
    startAt: string;
    endAt: string;
  },
) => {
  await EventService.getOwnedEvent(userId, payload.eventId);

  const startAt = new Date(payload.startAt);
  const endAt = new Date(payload.endAt);
  if (endAt <= startAt) {
    throw new AppError(httpStatus.BAD_REQUEST, "Promotion end must be after start");
  }
  if (payload.discountType === DiscountType.PERCENTAGE && payload.value > 100) {
    throw new AppError(httpStatus.BAD_REQUEST, "Percentage discount cannot exceed 100%");
  }

  return prisma.promoCode.create({
    data: {
      ...payload,
      code: payload.code.toUpperCase(),
      startAt,
      endAt,
    },
  });
};

const list = async (userId: string, eventId: string) => {
  await EventService.getOwnedEvent(userId, eventId);
  return prisma.promoCode.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });
};

const update = async (
  userId: string,
  promoId: string,
  payload: Record<string, unknown>,
) => {
  const promo = await prisma.promoCode.findUnique({ where: { id: promoId } });
  if (!promo) throw new AppError(httpStatus.NOT_FOUND, "Promo code not found");

  await EventService.getOwnedEvent(userId, promo.eventId);

  return prisma.promoCode.update({
    where: { id: promoId },
    data: {
      ...payload,
      ...("code" in payload
        ? { code: String(payload.code).toUpperCase() }
        : {}),
      ...("startAt" in payload
        ? { startAt: new Date(payload.startAt as string) }
        : {}),
      ...("endAt" in payload
        ? { endAt: new Date(payload.endAt as string) }
        : {}),
    },
  });
};

export const PromoService = { create, list, update };
