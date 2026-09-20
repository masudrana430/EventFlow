import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AnnouncementService } from "./announcement.service";

const send = catchAsync(async (req, res) => {
  const result = await AnnouncementService.send(req.user!.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Announcement sent",
    data: result,
  });
});

const listForEvent = catchAsync(async (req, res) => {
  const result = await AnnouncementService.listForEvent(req.params.eventId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Announcements retrieved",
    data: result,
  });
});

export const AnnouncementController = { send, listForEvent };
