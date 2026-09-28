import httpStatus from "http-status";
import type { UserRole, UserStatus } from "../../../generated/prisma/enums";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AdminService } from "./admin.service";

const createAdmin = catchAsync(async (req, res) => {
  const result = await AdminService.createAdmin(
    { userId: req.user!.userId, role: req.user!.role },
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Administrative account created",
    data: result,
  });
});

const listUsers = catchAsync(async (req, res) => {
  const result = await AdminService.listUsers(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users retrieved",
    data: result.data,
    meta: result.meta,
  });
});

const updateUserStatus = catchAsync(async (req, res) => {
  const result = await AdminService.updateUserStatus(
    { userId: req.user!.userId, role: req.user!.role as UserRole },
    String(req.params.userId),
    req.body.status as UserStatus,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User status updated",
    data: result,
  });
});

const getAuditLogs = catchAsync(async (req, res) => {
  const result = await AdminService.getAuditLogs(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Audit logs retrieved",
    data: result.data,
    meta: result.meta,
  });
});

const listSettings = catchAsync(async (_req, res) => {
  const result = await AdminService.listSettings();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Platform settings retrieved",
    data: result,
  });
});

const upsertSetting = catchAsync(async (req, res) => {
  const result = await AdminService.upsertSetting(
    req.user!.userId,
    String(req.params.key),
    req.body.value,
    req.body.description,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Platform setting updated",
    data: result,
  });
});

export const AdminController = {
  createAdmin,
  listUsers,
  updateUserStatus,
  getAuditLogs,
  listSettings,
  upsertSetting,
};
