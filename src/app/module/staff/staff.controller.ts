import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { StaffService } from "./staff.service";

const invite = catchAsync(async (req, res) => {
  const result = await StaffService.invite(req.user!.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Event staff invitation created",
    data: result,
  });
});

const accept = catchAsync(async (req, res) => {
  const result = await StaffService.accept(req.body.token);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event staff invitation accepted",
    data: result,
  });
});

const list = catchAsync(async (req, res) => {
  const result = await StaffService.list(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event staff retrieved",
    data: result,
  });
});

const assign = catchAsync(async (req, res) => {
  const result = await StaffService.assign(
    req.user!.userId,
    String(req.params.staffId),
    req.body.eventIds,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Staff assignments updated",
    data: result,
  });
});

const revoke = catchAsync(async (req, res) => {
  const result = await StaffService.revoke(
    req.user!.userId,
    String(req.params.staffId),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event staff access revoked",
    data: result,
  });
});

const myAssignments = catchAsync(async (req, res) => {
  const result = await StaffService.myAssignments(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Assigned events retrieved",
    data: result,
  });
});

export const StaffController = {
  invite,
  accept,
  list,
  assign,
  revoke,
  myAssignments,
};
