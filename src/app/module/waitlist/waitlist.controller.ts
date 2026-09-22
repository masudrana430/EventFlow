import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { WaitlistService } from "./waitlist.service";

const join = catchAsync(async (req, res) => {
  const result = await WaitlistService.join(
    req.user!.userId,
    req.body.ticketTypeId,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Joined ticket waitlist",
    data: result,
  });
});

const leave = catchAsync(async (req, res) => {
  const result = await WaitlistService.leave(
    req.user!.userId,
    String(req.params.ticketTypeId),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Left ticket waitlist",
    data: result,
  });
});

const mine = catchAsync(async (req, res) => {
  const result = await WaitlistService.mine(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Waitlist entries retrieved",
    data: result,
  });
});

export const WaitlistController = { join, leave, mine };
