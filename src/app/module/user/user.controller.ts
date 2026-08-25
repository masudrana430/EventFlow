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

export const UserController = {
	uploadProfileImage,
};