import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { NotificationService } from "./notification.service";

const listMine = catchAsync(async (req, res) => {
  const result = await NotificationService.listMine(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notifications retrieved",
    data: result,
  });
});

const markRead = catchAsync(async (req, res) => {
  const result = await NotificationService.markRead(
    req.user!.userId,
    req.params.notificationId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification marked as read",
    data: result,
  });
});

const markAllRead = catchAsync(async (req, res) => {
  const result = await NotificationService.markAllRead(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All notifications marked as read",
    data: result,
  });
});

export const NotificationController = { listMine, markRead, markAllRead };
