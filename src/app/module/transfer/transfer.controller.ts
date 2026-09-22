import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { TransferService } from "./transfer.service";

const create = catchAsync(async (req, res) => {
  const result = await TransferService.create(
    req.user!.userId,
    req.body.ticketId,
    req.body.recipientEmail,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Ticket transfer invitation sent",
    data: result,
  });
});

const accept = catchAsync(async (req, res) => {
  const result = await TransferService.accept(req.user!.userId, req.body.token);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Ticket transfer accepted",
    data: result,
  });
});

const mine = catchAsync(async (req, res) => {
  const result = await TransferService.myTransfers(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Ticket transfers retrieved",
    data: result,
  });
});

export const TransferController = { create, accept, mine };
