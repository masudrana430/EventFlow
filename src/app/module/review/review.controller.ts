import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ReviewService } from "./review.service";

const create = catchAsync(async (req, res) => {
  const result = await ReviewService.create(req.user!.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Review submitted",
    data: result,
  });
});

const eventReviews = catchAsync(async (req, res) => {
  const result = await ReviewService.eventReviews(req.params.eventId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Reviews retrieved",
    data: result,
  });
});

const moderate = catchAsync(async (req, res) => {
  const result = await ReviewService.moderate(
    req.params.reviewId,
    req.body.status,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Review moderation updated",
    data: result,
  });
});

export const ReviewController = { create, eventReviews, moderate };
