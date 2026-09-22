import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { RefundService } from "./refund.service";

const request = catchAsync(async (req, res) => {
  const result = await RefundService.request(req.user!.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Refund requested",
    data: result,
  });
});

const organizerList = catchAsync(async (req, res) => {
  const result = await RefundService.listForOrganizer(
    req.user!.userId,
    req.query.eventId ? String(req.query.eventId) : undefined,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Refund requests retrieved",
    data: result,
  });
});

const all = catchAsync(async (_req, res) => {
  const result = await RefundService.listAll();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Refund requests retrieved",
    data: result,
  });
});

const decide = catchAsync(async (req, res) => {
  const result = await RefundService.decide(
    { userId: req.user!.userId, role: req.user!.role },
    String(req.params.refundId),
    req.body.decision,
    req.body.approvedAmount,
    req.body.reason,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Refund decision saved",
    data: result,
  });
});

const markRefunded = catchAsync(async (req, res) => {
  const result = await RefundService.markRefunded(
    req.user!.userId,
    String(req.params.refundId),
    req.body.gatewayRefundId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Refund marked completed",
    data: result,
  });
});

export const RefundController = {
  request,
  organizerList,
  all,
  decide,
  markRefunded,
};
