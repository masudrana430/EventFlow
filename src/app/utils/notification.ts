import { prisma } from "../lib/prisma";

export const createNotification = async (payload: {
  userId: string;
  type: string;
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
}) =>
  prisma.notification.create({
    data: payload,
  });
