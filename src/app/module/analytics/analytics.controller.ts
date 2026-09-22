import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AnalyticsService } from "./analytics.service";

const attendee = catchAsync(async (req, res) => {
  const result = await AnalyticsService.attendee(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Attendee analytics retrieved",
    data: result,
  });
});

const organizer = catchAsync(async (req, res) => {
  const result = await AnalyticsService.organizer(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Organizer analytics retrieved",
    data: result,
  });
});

const staff = catchAsync(async (req, res) => {
  const result = await AnalyticsService.staff(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Staff analytics retrieved",
    data: result,
  });
});

const admin = catchAsync(async (_req, res) => {
  const result = await AnalyticsService.admin();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin analytics retrieved",
    data: result,
  });
});

export const AnalyticsController = { attendee, organizer, staff, admin };
