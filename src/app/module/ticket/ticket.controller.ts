import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { TicketService } from "./ticket.service";

const myTickets = catchAsync(async (req, res) => {
  const result = await TicketService.myTickets(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tickets retrieved",
    data: result,
  });
});

const getMyTicket = catchAsync(async (req, res) => {
  const result = await TicketService.getMyTicket(
    req.user!.userId,
    req.params.ticketId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Ticket retrieved",
    data: result,
  });
});

const downloadPdf = catchAsync(async (req, res) => {
  const buffer = await TicketService.generatePdf(
    req.user!.userId,
    req.params.ticketId,
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="eventflow-ticket-${req.params.ticketId}.pdf"`,
  );
  res.status(httpStatus.OK).send(buffer);
});

const qrCheckIn = catchAsync(async (req, res) => {
  const result = await TicketService.qrCheckIn(
    req.user!.userId,
    req.user!.role,
    req.body.eventId,
    req.body.qrPayload,
    req.body.deviceInfo,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Ticket checked in",
    data: result,
  });
});

const manualSearch = catchAsync(async (req, res) => {
  const result = await TicketService.manualSearch(
    req.user!.userId,
    req.user!.role,
    req.params.eventId,
    String(req.query.search ?? ""),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tickets found",
    data: result,
  });
});

const manualCheckIn = catchAsync(async (req, res) => {
  const result = await TicketService.manualCheckIn(
    req.user!.userId,
    req.user!.role,
    req.body.eventId,
    req.body.ticketId,
    req.body.deviceInfo,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Ticket manually checked in",
    data: result,
  });
});

export const TicketController = {
  myTickets,
  getMyTicket,
  downloadPdf,
  qrCheckIn,
  manualSearch,
  manualCheckIn,
};
