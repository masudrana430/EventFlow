import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PayoutService } from "./payout.service";

const request = catchAsync(async (req, res) => {
  const result = await PayoutService.request(
    req.user!.userId,
    req.params.eventId,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Payout requested",
    data: result,
  });
});

const mine = catchAsync(async (req, res) => {
  const result = await PayoutService.mine(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payouts retrieved",
    data: result,
  });
});

const all = catchAsync(async (_req, res) => {
  const result = await PayoutService.all();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payouts retrieved",
    data: result,
  });
});

const decide = catchAsync(async (req, res) => {
  const result = await PayoutService.decide(
    req.user!.userId,
    req.params.payoutId,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payout status updated",
    data: result,
  });
});

export const PayoutController = { request, mine, all, decide };
