import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser } from "./auth.interface";
import { AuthService } from "./auth.service";

const setAuthCookies = (
	res: Response,
	accessToken: string,
	refreshToken: string,
) => {
	const isProduction = config.node_env === "production";

	res.cookie("accessToken", accessToken, {
		httpOnly: true,
		secure: isProduction,
		sameSite: isProduction ? "none" : "lax",
		maxAge: 1000 * 60 * 60 * 24, // 1 day
	});

	res.cookie("refreshToken", refreshToken, {
		httpOnly: true,
		secure: isProduction,
		sameSite: isProduction ? "none" : "lax",
		maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
	});
};

const registerAttendee = catchAsync(
	async (req: Request, res: Response) => {
		const payload = req.body;

		const result =
			await AuthService.registerAttendee(payload);

		sendResponse(res, {
			statusCode: httpStatus.CREATED,
			success: true,
			message:
				"Attendee registered successfully. Please verify your email.",
			data: result,
		});
	},
);

const loginUser = catchAsync(
	async (req: Request, res: Response) => {
		const payload = req.body;

		const result = await AuthService.loginUser(payload);

		const {
			accessToken,
			refreshToken,
			user,
		} = result;

		setAuthCookies(
			res,
			accessToken,
			refreshToken,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "User logged in successfully",
			data: {
				user,
			},
		});
	},
);

const getMe = catchAsync(
	async (req: Request, res: Response) => {
		const user =
			req.user as unknown as IRequestUser;

		if (!user) {
			throw new Error(
				"User information is missing in the request",
			);
		}

		const result =
			await AuthService.getMe(user);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message:
				"User profile fetched successfully",
			data: result,
		});
	},
);

const refreshToken = catchAsync(
	async (req: Request, res: Response) => {
		const token =
			req.cookies?.refreshToken;

		if (!token) {
			throw new Error(
				"Refresh token is missing",
			);
		}

		const result =
			await AuthService.refreshToken(token);

		setAuthCookies(
			res,
			result.accessToken,
			result.refreshToken,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message:
				"New tokens generated successfully",
			data: null,
		});
	},
);

export const AuthController = {
	registerAttendee,
	loginUser,
	getMe,
	refreshToken,
};