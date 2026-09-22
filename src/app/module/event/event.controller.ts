import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { EventService } from "./event.service";

const create = catchAsync(async (req, res) => {
  const result = await EventService.create(req.user!.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Event created as draft",
    data: result,
  });
});

const update = catchAsync(async (req, res) => {
  const result = await EventService.update(
    req.user!.userId,
    String(req.params.eventId),
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event updated",
    data: result,
  });
});

const uploadCover = catchAsync(async (req, res) => {
  const result = await EventService.uploadCover(
    req.user!.userId,
    String(req.params.eventId),
    req.file!,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event cover uploaded",
    data: result,
  });
});

const uploadGallery = catchAsync(async (req, res) => {
  const result = await EventService.uploadGallery(
    req.user!.userId,
    String(req.params.eventId),
    (req.files as Express.Multer.File[]) ?? [],
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event gallery updated",
    data: result,
  });
});

const submitForReview = catchAsync(async (req, res) => {
  const result = await EventService.submitForReview(
    req.user!.userId,
    String(req.params.eventId),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event submitted for review",
    data: result,
  });
});

const review = catchAsync(async (req, res) => {
  const result = await EventService.review(
    req.user!.userId,
    String(req.params.eventId),
    req.body.decision,
    req.body.reason,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event review completed",
    data: result,
  });
});

const publish = catchAsync(async (req, res) => {
  const result = await EventService.publish(
    req.user!.userId,
    String(req.params.eventId),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.status === "PUBLISHED" ? "Event published" : "Event scheduled for publication",
    data: result,
  });
});

const cancel = catchAsync(async (req, res) => {
  const result = await EventService.cancel(
    req.user!.userId,
    String(req.params.eventId),
    req.body.reason,
    req.user!.role,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event cancelled",
    data: result,
  });
});

const suspend = catchAsync(async (req, res) => {
  const result = await EventService.suspend(
    req.user!.userId,
    String(req.params.eventId),
    req.body.reason,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event suspended",
    data: result,
  });
});

const restore = catchAsync(async (req, res) => {
  const result = await EventService.restore(
    req.user!.userId,
    String(req.params.eventId),
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event restored",
    data: result,
  });
});

const myEvents = catchAsync(async (req, res) => {
  const result = await EventService.myEvents(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Organizer events retrieved",
    data: result,
  });
});

const adminList = catchAsync(async (req, res) => {
  const result = await EventService.adminList(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Events retrieved",
    data: result.data,
    meta: result.meta,
  });
});

const publicList = catchAsync(async (req, res) => {
  const result = await EventService.publicList(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Published events retrieved",
    data: result.data,
    meta: result.meta,
  });
});

const publicDetails = catchAsync(async (req, res) => {
  const result = await EventService.publicDetails(String(req.params.eventIdOrSlug));
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Event retrieved",
    data: result,
  });
});

export const EventController = {
  create,
  update,
  uploadCover,
  uploadGallery,
  submitForReview,
  review,
  publish,
  cancel,
  suspend,
  restore,
  myEvents,
  adminList,
  publicList,
  publicDetails,
};
