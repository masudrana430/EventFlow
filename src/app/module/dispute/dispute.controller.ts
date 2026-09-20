import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { DisputeService } from "./dispute.service";

const create = catchAsync(async (req, res) => {
  const result = await DisputeService.create(req.user!.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Dispute opened",
    data: result,
  });
});

const mine = catchAsync(async (req, res) => {
  const result = await DisputeService.myDisputes(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Disputes retrieved",
    data: result,
  });
});

const organizerList = catchAsync(async (req, res) => {
  const result = await DisputeService.organizerList(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Organizer disputes retrieved",
    data: result,
  });
});

const organizerRespond = catchAsync(async (req, res) => {
  const result = await DisputeService.organizerRespond(
    req.user!.userId,
    String(req.params.disputeId),
    req.body.response,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dispute response saved",
    data: result,
  });
});

const adminList = catchAsync(async (_req, res) => {
  const result = await DisputeService.adminList();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Disputes retrieved",
    data: result,
  });
});

const decide = catchAsync(async (req, res) => {
  const result = await DisputeService.decide(
    req.user!.userId,
    String(req.params.disputeId),
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dispute decision saved",
    data: result,
  });
});

export const DisputeController = {
  create,
  mine,
  organizerList,
  organizerRespond,
  adminList,
  decide,
};
