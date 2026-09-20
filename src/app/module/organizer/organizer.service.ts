import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import httpStatus from "http-status";
import {
  OrganizerApprovalStatus,
  UserRole,
  UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { safeDestroyAsset, uploadBuffer } from "../../lib/upload";
import { AppError } from "../../utils/AppError";
import { writeAuditLog } from "../../utils/audit";
import { safeSendEmail, sendEmail } from "../../utils/email";
import { createNotification } from "../../utils/notification";

const OTP_TTL = 10 * 60;

type ApplicationPayload = {
  user: {
    name: string;
    email: string;
    password: string;
  };
  organizer: {
    organizationName: string;
    organizationType?: string;
    phone: string;
    address: string;
    experience?: string;
    websiteUrl?: string;
    socialMediaUrl?: string;
  };
};

const apply = async (
  payload: ApplicationPayload,
  document?: Express.Multer.File,
) => {
  const email = payload.user.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { organizer: true },
  });

  let reapplyUserId: string | undefined;

  if (existing) {
    const rejectedAt = existing.organizer?.rejectedAt;
    const canReapply =
      existing.role === UserRole.ORGANIZER &&
      existing.organizer?.approvalStatus === OrganizerApprovalStatus.REJECTED &&
      rejectedAt &&
      rejectedAt.getTime() <= Date.now() - 30 * 24 * 60 * 60 * 1000;

    if (!canReapply) {
      throw new AppError(httpStatus.CONFLICT, "An account with this email already exists");
    }

    reapplyUserId = existing.id;
  }

  if (!redisClient.isOpen) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Organizer application service is temporarily unavailable",
    );
  }

  const cooldownKey = `organizer-application:cooldown:${email}`;
  if (await redisClient.exists(cooldownKey)) {
    throw new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      "Please wait 60 seconds before submitting again",
    );
  }

  let verificationDocument: string | undefined;
  let verificationDocumentPublicId: string | undefined;

  if (document) {
    const allowed = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);

    if (!allowed.has(document.mimetype)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "Verification document must be PDF, JPG, PNG, or WEBP",
      );
    }

    const uploaded = await uploadBuffer(document.buffer, {
      folder: "eventflow/organizer-verification",
      resource_type: document.mimetype === "application/pdf" ? "raw" : "image",
    });

    verificationDocument = uploaded.secure_url;
    verificationDocumentPublicId = uploaded.public_id;
  }

  if (!verificationDocument && !reapplyUserId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Verification document is required",
    );
  }

  const hashedPassword = await bcrypt.hash(
    payload.user.password,
    config.bcrypt_salt_rounds,
  );
  const otp = crypto.randomInt(100000, 1000000).toString();

  await redisClient.set(
    `organizer-application:data:${email}`,
    JSON.stringify({
      ...payload,
      user: {
        ...payload.user,
        email,
        password: hashedPassword,
      },
      verificationDocument,
      verificationDocumentPublicId,
      reapplyUserId,
    }),
    { expiration: { type: "EX", value: OTP_TTL } },
  );

  await redisClient.set(`organizer-application:otp:${email}`, otp, {
    expiration: { type: "EX", value: OTP_TTL },
  });
  await redisClient.set(cooldownKey, "1", {
    expiration: { type: "EX", value: 60 },
  });

  try {
    await sendEmail({
      to: email,
      subject: "Verify your EventFlow organizer application",
      html: `<p>Your organizer application verification code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
    });
  } catch (error) {
    if (verificationDocumentPublicId) {
      await safeDestroyAsset(
        verificationDocumentPublicId,
        document?.mimetype === "application/pdf" ? "raw" : "image",
      );
    }
    throw error;
  }
};

const verifyApplication = async (emailInput: string, otp: string) => {
  const email = emailInput.trim().toLowerCase();
  const storedOtp = await redisClient.get(`organizer-application:otp:${email}`);
  const raw = await redisClient.get(`organizer-application:data:${email}`);

  if (!storedOtp || !raw) {
    throw new AppError(httpStatus.BAD_REQUEST, "Application OTP or data has expired");
  }

  const attemptsKey = `organizer-application:attempts:${email}`;
  const attempts = await redisClient.incr(attemptsKey);
  if (attempts === 1) await redisClient.expire(attemptsKey, OTP_TTL);
  if (attempts > 5) {
    throw new AppError(httpStatus.TOO_MANY_REQUESTS, "Too many invalid OTP attempts");
  }

  if (storedOtp !== otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP does not match");
  }

  const data = JSON.parse(raw) as ApplicationPayload & {
    verificationDocument?: string;
    verificationDocumentPublicId?: string;
    reapplyUserId?: string;
  };

  const result = data.reapplyUserId
    ? await prisma.user.update({
        where: { id: data.reapplyUserId },
        data: {
          name: data.user.name,
          password: data.user.password,
          isEmailVerified: true,
          status: UserStatus.ACTIVE,
          organizer: {
            update: {
              ...data.organizer,
              ...(data.verificationDocument
                ? {
                    verificationDocument: data.verificationDocument,
                    verificationDocumentPublicId:
                      data.verificationDocumentPublicId,
                  }
                : {}),
              approvalStatus: OrganizerApprovalStatus.PENDING,
              rejectionReason: null,
              rejectedAt: null,
              approvedAt: null,
            },
          },
        },
        include: { organizer: true },
        omit: { password: true },
      })
    : await prisma.user.create({
        data: {
          name: data.user.name,
          email,
          password: data.user.password,
          role: UserRole.ORGANIZER,
          status: UserStatus.ACTIVE,
          isEmailVerified: true,
          organizer: {
            create: {
              ...data.organizer,
              verificationDocument: data.verificationDocument,
              verificationDocumentPublicId:
                data.verificationDocumentPublicId,
            },
          },
        },
        include: { organizer: true },
        omit: { password: true },
      });

  await redisClient.del([
    `organizer-application:otp:${email}`,
    `organizer-application:data:${email}`,
    attemptsKey,
  ]);

  void safeSendEmail({
    to: email,
    subject: "EventFlow organizer application received",
    html: "<p>Your email is verified. Your organizer application is now pending administrative review.</p>",
  });

  return result;
};

const listApplications = async (query: Record<string, unknown>) => {
  const page = Math.max(Number(query.page ?? 1), 1);
  const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);
  const status = query.status as OrganizerApprovalStatus | undefined;
  const searchTerm = String(query.searchTerm ?? "").trim();

  const where = {
    ...(status ? { approvalStatus: status } : {}),
    ...(searchTerm
      ? {
          OR: [
            { organizationName: { contains: searchTerm, mode: "insensitive" as const } },
            { user: { name: { contains: searchTerm, mode: "insensitive" as const } } },
            { user: { email: { contains: searchTerm, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.organizer.findMany({
      where,
      include: {
        user: {
          omit: { password: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.organizer.count({ where }),
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

const decideApplication = async (
  organizerId: string,
  status: "APPROVED" | "REJECTED",
  rejectionReason: string | undefined,
  actorUserId: string,
) => {
  const organizer = await prisma.organizer.findUnique({
    where: { id: organizerId },
    include: { user: true },
  });

  if (!organizer) {
    throw new AppError(httpStatus.NOT_FOUND, "Organizer application not found");
  }

  if (organizer.approvalStatus !== OrganizerApprovalStatus.PENDING) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Only pending applications can be reviewed",
    );
  }

  if (status === "REJECTED" && !rejectionReason) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Rejection reason is required",
    );
  }

  const now = new Date();
  const updated = await prisma.organizer.update({
    where: { id: organizerId },
    data:
      status === "APPROVED"
        ? {
            approvalStatus: OrganizerApprovalStatus.APPROVED,
            approvedAt: now,
            rejectedAt: null,
            rejectionReason: null,
          }
        : {
            approvalStatus: OrganizerApprovalStatus.REJECTED,
            rejectedAt: now,
            approvedAt: null,
            rejectionReason,
          },
    include: {
      user: {
        omit: { password: true },
      },
    },
  });

  await writeAuditLog({
    actorUserId,
    action: status === "APPROVED" ? "ORGANIZER_APPROVED" : "ORGANIZER_REJECTED",
    targetType: "Organizer",
    targetId: organizerId,
    previousValue: { approvalStatus: organizer.approvalStatus },
    newValue: {
      approvalStatus: updated.approvalStatus,
      rejectionReason: updated.rejectionReason,
    },
  });

  await createNotification({
    userId: organizer.userId,
    type: "ORGANIZER_APPLICATION",
    title:
      status === "APPROVED"
        ? "Organizer application approved"
        : "Organizer application rejected",
    message:
      status === "APPROVED"
        ? "Your organizer account is approved. You can now create events."
        : `Your organizer application was rejected: ${rejectionReason}`,
    resourceType: "Organizer",
    resourceId: organizerId,
  });

  void safeSendEmail({
    to: organizer.user.email,
    subject:
      status === "APPROVED"
        ? "Your EventFlow organizer account is approved"
        : "Your EventFlow organizer application was rejected",
    html:
      status === "APPROVED"
        ? "<p>Your organizer account is approved. You may now sign in and create events.</p>"
        : `<p>Your application was rejected.</p><p>Reason: ${rejectionReason}</p><p>You may reapply after 30 days.</p>`,
  });

  return updated;
};

const getMyProfile = async (userId: string) => {
  const organizer = await prisma.organizer.findUnique({
    where: { userId },
    include: {
      user: {
        omit: { password: true },
      },
    },
  });

  if (!organizer) {
    throw new AppError(httpStatus.NOT_FOUND, "Organizer profile not found");
  }

  return organizer;
};

const updateMyProfile = async (userId: string, payload: Record<string, unknown>) => {
  const organizer = await prisma.organizer.findUnique({ where: { userId } });
  if (!organizer) {
    throw new AppError(httpStatus.NOT_FOUND, "Organizer profile not found");
  }

  return prisma.organizer.update({
    where: { id: organizer.id },
    data: payload,
  });
};

export const OrganizerService = {
  apply,
  verifyApplication,
  listApplications,
  decideApplication,
  getMyProfile,
  updateMyProfile,
};
