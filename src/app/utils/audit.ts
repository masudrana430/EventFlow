import { prisma } from "../lib/prisma";

export const writeAuditLog = async (payload: {
  actorUserId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
}) => {
  await prisma.auditLog.create({
    data: {
      actorUserId: payload.actorUserId,
      action: payload.action,
      targetType: payload.targetType,
      targetId: payload.targetId,
      previousValue: payload.previousValue as object | undefined,
      newValue: payload.newValue as object | undefined,
      ipAddress: payload.ipAddress,
      userAgent: payload.userAgent,
    },
  });
};
