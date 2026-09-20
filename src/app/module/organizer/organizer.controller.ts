import type { Request } from "express";
import httpStatus from "http-status";
import { organizerApplicationSchema } from "./organizer.validation";
import { OrganizerService } from "./organizer.service";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";

const apply = catchAsync(async (req: Request, res) => {
  let parsed: unknown = req.body;

  if (typeof req.body?.data === "string") {
    try {
      parsed = JSON.parse(req.body.data);
    } catch {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "The data field must contain valid JSON",
      );
    }
  }

  const result = organizerApplicationSchema.safeParse(parsed);
  if (!result.success) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      result.error.issues[0]?.message ?? "Invalid application",
    );
  }

  await OrganizerService.apply(result.data, req.file);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Organizer application OTP sent",
    data: null,
  });
});

const verify = catchAsync(async (req, res) => {
  const result = await OrganizerService.verifyApplication(
    req.body.email,
    req.body.otp,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Organizer application submitted for review",
    data: result,
  });
});

const listApplications = catchAsync(async (req, res) => {
  const result = await OrganizerService.listApplications(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Organizer applications retrieved",
    data: result.data,
    meta: result.meta,
  });
});

const decide = catchAsync(async (req, res) => {
  const result = await OrganizerService.decideApplication(
    req.params.organizerId,
    req.body.status,
    req.body.rejectionReason,
    req.user!.userId,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `Organizer application ${req.body.status.toLowerCase()}`,
    data: result,
  });
});

const getMyProfile = catchAsync(async (req, res) => {
  const result = await OrganizerService.getMyProfile(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Organizer profile retrieved",
    data: result,
  });
});

const updateMyProfile = catchAsync(async (req, res) => {
  const result = await OrganizerService.updateMyProfile(
    req.user!.userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Organizer profile updated",
    data: result,
  });
});

export const OrganizerController = {
  apply,
  verify,
  listApplications,
  decide,
  getMyProfile,
  updateMyProfile,
};
