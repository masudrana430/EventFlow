import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PromoService } from "./promo.service";

const create = catchAsync(async (req, res) => {
  const result = await PromoService.create(req.user!.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Promo code created",
    data: result,
  });
});

const list = catchAsync(async (req, res) => {
  const result = await PromoService.list(req.user!.userId, String(req.params.eventId));
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Promo codes retrieved",
    data: result,
  });
});

const update = catchAsync(async (req, res) => {
  const result = await PromoService.update(
    req.user!.userId,
    String(req.params.promoId),
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Promo code updated",
    data: result,
  });
});

export const PromoController = { create, list, update };
