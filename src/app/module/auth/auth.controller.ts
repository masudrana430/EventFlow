import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IRequestUser, ISessionMeta } from "./auth.interface";
import { AuthService } from "./auth.service";

const sessionMeta = (req: Request): ISessionMeta => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent") ?? undefined,
});

const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
) => {
  const production = config.node_env === "production";
  const base = {
    httpOnly: true,
    secure: production,
    sameSite: production ? ("none" as const) : ("lax" as const),
  };

  res.cookie("accessToken", accessToken, {
    ...base,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("refreshToken", refreshToken, {
    ...base,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const clearAuthCookies = (res: Response) => {
  const production = config.node_env === "production";
  const options = {
    httpOnly: true,
    secure: production,
    sameSite: production ? ("none" as const) : ("lax" as const),
  };

  res.clearCookie("accessToken", options);
  res.clearCookie("refreshToken", options);
};

const registerAttendee = catchAsync(async (req, res) => {
  await AuthService.registerAttendee(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Verification OTP sent",
    data: null,
  });
});

const resendAttendeeOtp = catchAsync(async (req, res) => {
  await AuthService.resendAttendeeOtp(req.body.email);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "A new verification OTP was sent",
    data: null,
  });
});

const verifyAttendeeEmail = catchAsync(async (req, res) => {
  const result = await AuthService.verifyAttendeeEmail(req.body, sessionMeta(req));
  setAuthCookies(res, result.accessToken, result.refreshToken);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Email verified successfully",
    data: result,
  });
});

const loginUser = catchAsync(async (req, res) => {
  const result = await AuthService.loginUser(req.body, sessionMeta(req));
  setAuthCookies(res, result.accessToken, result.refreshToken);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged in successfully",
    data: result,
  });
});

const getMe = catchAsync(async (req, res) => {
  const result = await AuthService.getMe(req.user as IRequestUser);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile retrieved successfully",
    data: result,
  });
});

const refreshToken = catchAsync(async (req, res) => {
  const token = req.cookies?.refreshToken;
  const result = await AuthService.refreshToken(token, sessionMeta(req));
  setAuthCookies(res, result.accessToken, result.refreshToken);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Tokens refreshed successfully",
    data: result,
  });
});

const googleLogin = catchAsync(async (req, res) => {
  const result = await AuthService.googleLogin(req.body, sessionMeta(req));
  setAuthCookies(res, result.accessToken, result.refreshToken);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Google login successful",
    data: result,
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  await AuthService.forgotPassword(req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password reset OTP sent",
    data: null,
  });
});

const resetPassword = catchAsync(async (req, res) => {
  await AuthService.resetPassword(req.body);
  clearAuthCookies(res);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password reset successfully. Please log in again",
    data: null,
  });
});

const changePassword = catchAsync(async (req, res) => {
  await AuthService.changePassword(req.user as IRequestUser, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password changed successfully",
    data: null,
  });
});

const setPassword = catchAsync(async (req, res) => {
  await AuthService.setPassword(req.user as IRequestUser, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password set successfully",
    data: null,
  });
});

const logout = catchAsync(async (req, res) => {
  await AuthService.logout(req.user as IRequestUser);
  clearAuthCookies(res);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged out successfully",
    data: null,
  });
});

const logoutAll = catchAsync(async (req, res) => {
  await AuthService.logoutAll(req.user as IRequestUser);
  clearAuthCookies(res);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Logged out from all devices",
    data: null,
  });
});

export const AuthController = {
  registerAttendee,
  resendAttendeeOtp,
  verifyAttendeeEmail,
  loginUser,
  getMe,
  refreshToken,
  googleLogin,
  forgotPassword,
  resetPassword,
  changePassword,
  setPassword,
  logout,
  logoutAll,
};
