import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import httpStatus from "http-status";
import { UserRole, UserStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { writeAuditLog } from "../../utils/audit";
import { safeSendEmail } from "../../utils/email";

const createAdmin = async (
  actor: { userId: string; role: UserRole },
  payload: {
    name: string;
    email: string;
    personalEmail: string;
    phone?: string;
    role: "ADMIN" | "SUPER_ADMIN";
  },
) => {
  const role = payload.role as UserRole;

  if (role === UserRole.SUPER_ADMIN && actor.role !== UserRole.SUPER_ADMIN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only a Super Admin can create another Super Admin",
    );
  }

  if (await prisma.user.findUnique({ where: { email: payload.email } })) {
    throw new AppError(httpStatus.CONFLICT, "User email already exists");
  }

  const temporaryPassword = `Ef@${crypto.randomBytes(6).toString("base64url")}9A`;
  const password = await bcrypt.hash(
    temporaryPassword,
    config.bcrypt_salt_rounds,
  );

  const user = await prisma.user.create({
    data: {
      name: payload.name,
      email: payload.email,
      personalEmail: payload.personalEmail,
      phone: payload.phone,
      password,
      role,
      status: UserStatus.ACTIVE,
      isEmailVerified: true,
      mustChangePassword: true,
      createdByUserId: actor.userId,
    },
    omit: { password: true },
  });

  await writeAuditLog({
    actorUserId: actor.userId,
    action: role === UserRole.SUPER_ADMIN ? "SUPER_ADMIN_CREATED" : "ADMIN_CREATED",
    targetType: "User",
    targetId: user.id,
    newValue: { email: user.email, role: user.role },
  });

  void safeSendEmail({
    to: payload.personalEmail,
    subject: "Your EventFlow administrative account",
    html: `
      <h2>Your EventFlow account was created</h2>
      <p>Organization email: <strong>${payload.email}</strong></p>
      <p>Temporary password: <strong>${temporaryPassword}</strong></p>
      <p>Sign in and change this password immediately.</p>
    `,
  });

  return user;
};

const listUsers = async (query: Record<string, unknown>) => {
  const page = Math.max(Number(query.page ?? 1), 1);
  const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);
  const searchTerm = String(query.searchTerm ?? "").trim();
  const role = query.role as UserRole | undefined;
  const status = query.status as UserStatus | undefined;

  const where = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(searchTerm
      ? {
          OR: [
            { name: { contains: searchTerm, mode: "insensitive" as const } },
            { email: { contains: searchTerm, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      omit: { password: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const updateUserStatus = async (
  actor: { userId: string; role: UserRole },
  targetUserId: string,
  status: UserStatus,
) => {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (
    [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(target.role) &&
    actor.role !== UserRole.SUPER_ADMIN
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Only a Super Admin can manage Admin or Super Admin accounts",
    );
  }

  if (actor.userId === targetUserId && status === UserStatus.BLOCKED) {
    throw new AppError(httpStatus.BAD_REQUEST, "You cannot block your own account");
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { status },
    omit: { password: true },
  });

  if (status === UserStatus.BLOCKED) {
    await prisma.session.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await writeAuditLog({
    actorUserId: actor.userId,
    action: status === UserStatus.BLOCKED ? "USER_BLOCKED" : "USER_UNBLOCKED",
    targetType: "User",
    targetId: targetUserId,
    previousValue: { status: target.status },
    newValue: { status },
  });

  return updated;
};

const getAuditLogs = async (query: Record<string, unknown>) => {
  const page = Math.max(Number(query.page ?? 1), 1);
  const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 100);

  const [data, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count(),
  ]);

  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const listSettings = () =>
  prisma.platformSetting.findMany({ orderBy: { key: "asc" } });

const upsertSetting = async (
  actorUserId: string,
  key: string,
  value: unknown,
  description?: string,
) => {
  const previous = await prisma.platformSetting.findUnique({ where: { key } });

  const setting = await prisma.platformSetting.upsert({
    where: { key },
    create: {
      key,
      value: value as object,
      description,
      updatedByUserId: actorUserId,
    },
    update: {
      value: value as object,
      description,
      updatedByUserId: actorUserId,
    },
  });

  await writeAuditLog({
    actorUserId,
    action: "PLATFORM_SETTING_UPDATED",
    targetType: "PlatformSetting",
    targetId: setting.id,
    previousValue: previous?.value,
    newValue: setting.value,
  });

  return setting;
};

export const AdminService = {
  createAdmin,
  listUsers,
  updateUserStatus,
  getAuditLogs,
  listSettings,
  upsertSetting,
};
