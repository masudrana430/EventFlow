import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { TicketTypeService } from "./ticketType.service";

const create = catchAsync(async (req, res) => {
  const result = await TicketTypeService.create(
    req.user!.userId,
    String(req.params.eventId),
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Ticket type created",
    data: result,
  });
});

const update = catchAsync(async (req, res) => {
  const result = await TicketTypeService.update(
    req.user!.userId,
    String(req.params.ticketTypeId),
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Ticket type updated",
    data: result,
  });
});

const remove = catchAsync(async (req, res) => {
  const result = await TicketTypeService.remove(
    req.user!.userId,
    String(req.params.ticketTypeId),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result ? "Ticket type disabled" : "Ticket type deleted",
    data: result,
  });
});

const listPublic = catchAsync(async (req, res) => {
  const result = await TicketTypeService.listPublic(String(req.params.eventId));
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Ticket types retrieved",
    data: result,
  });
});

export const TicketTypeController = {
  create,
  update,
  remove,
  listPublic,
};
