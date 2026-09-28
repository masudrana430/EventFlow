/** biome-ignore-all lint/correctness/noUnusedImports: <explanation> */
/** biome-ignore-all lint/style/useImportType: <explanation> */
// biome-ignore assist/source/organizeImports: <explanation>
import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { UserServices } from "./user.service";

const uploadProfileImage = catchAsync(
	async (req: Request, res: Response) => {
		if (!req.file) {
			throw new Error("No file uploaded");
		}

    if (!req.file.mimetype.startsWith("image/")) {
      throw new Error("Profile image must be an image file");
    }

		const userId = req.user?.userId;

		if (!userId) {
			throw new Error("User not authenticated");
		}

		const result =
			await UserServices.uploadProfileImage(
				req.file.buffer,
				userId,
			);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message:
				"Profile image uploaded successfully",
			data: result,
		});
	},
);

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new Error("User not authenticated");
  }

  const result = await UserServices.updateMyProfile(userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

export const UserController = {
  uploadProfileImage,
  updateMyProfile,
};