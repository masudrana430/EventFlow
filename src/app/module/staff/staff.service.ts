import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import httpStatus from "http-status";
import {
  OrganizerApprovalStatus,
  StaffInvitationStatus,
  UserRole,
  UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { safeSendEmail } from "../../utils/email";
import { renderTransactionalEmail } from "../../utils/emailTemplates";
import { randomToken, sha256 } from "../../utils/security";

const getOrganizer = async (userId: string) => {
  const organizer = await prisma.organizer.findUnique({ where: { userId } });
  if (!organizer || organizer.approvalStatus !== OrganizerApprovalStatus.APPROVED) {
    throw new AppError(httpStatus.FORBIDDEN, "Approved organizer required");
  }
  return organizer;
};

const verifyEventsOwned = async (organizerId: string, eventIds: string[]) => {
  const count = await prisma.event.count({
    where: {
      id: { in: eventIds },
      organizerId,
      isDeleted: false,
    },
  });

  if (count !== new Set(eventIds).size) {
    throw new AppError(httpStatus.FORBIDDEN, "One or more events do not belong to you");
  }
};

const invite = async (
  userId: string,
  payload: { name: string; email: string; eventIds: string[] },
) => {
  const organizer = await getOrganizer(userId);
  await verifyEventsOwned(organizer.id, payload.eventIds);

  const existing = await prisma.user.findUnique({
    where: { email: payload.email },
    include: { eventStaff: true },
  });

  if (existing && existing.role !== UserRole.EVENT_STAFF) {
    throw new AppError(
      httpStatus.CONFLICT,
      "This email belongs to a non-staff account",
    );
  }

  if (
    existing?.eventStaff &&
    existing.eventStaff.invitedByOrganizerId !== organizer.id
  ) {
    throw new AppError(
      httpStatus.CONFLICT,
      "This staff account is managed by another organizer",
    );
  }

  if (
    existing?.eventStaff?.invitationStatus === StaffInvitationStatus.ACCEPTED
  ) {
    await verifyEventsOwned(organizer.id, payload.eventIds);
    for (const eventId of payload.eventIds) {
      await prisma.eventStaffAssignment.upsert({
        where: {
          eventStaffId_eventId: {
            eventStaffId: existing.eventStaff.id,
            eventId,
          },
        },
        create: {
          eventStaffId: existing.eventStaff.id,
          eventId,
          assignedByOrganizerId: organizer.id,
          isActive: true,
        },
        update: { isActive: true },
      });
    }
    return { staff: existing.eventStaff, temporaryPassword: null };
  }

  const token = randomToken();
  const temporaryPassword = `Ef@${crypto.randomBytes(6).toString("base64url")}8A`;
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  let user = existing;

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        password: await bcrypt.hash(temporaryPassword, config.bcrypt_salt_rounds),
        role: UserRole.EVENT_STAFF,
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        mustChangePassword: true,
        eventStaff: {
          create: {
            invitedByOrganizerId: organizer.id,
            invitationStatus: StaffInvitationStatus.PENDING,
            invitationExpiresAt: expiresAt,
            invitationTokenHash: sha256(token),
          },
        },
      },
      include: { eventStaff: true },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: payload.name,
        eventStaff: {
          update: {
            invitationStatus: StaffInvitationStatus.PENDING,
            invitationExpiresAt: expiresAt,
            invitationTokenHash: sha256(token),
          },
        },
      },
      include: { eventStaff: true },
    });
  }

  const staff = user.eventStaff!;

  for (const eventId of payload.eventIds) {
    await prisma.eventStaffAssignment.upsert({
      where: {
        eventStaffId_eventId: {
          eventStaffId: staff.id,
          eventId,
        },
      },
      create: {
        eventStaffId: staff.id,
        eventId,
        assignedByOrganizerId: organizer.id,
        isActive: false,
      },
      update: { isActive: false },
    });
  }

  void safeSendEmail({
    to: payload.email,
    subject: "EventFlow event staff invitation",
    html: await renderTransactionalEmail({
      name: payload.name,
      heading: "You're invited to join EventFlow Event Staff",
      message:
        "An EventFlow organizer invited you to help manage one or more events. Accept the invitation before signing in.",
      preheader: "You have a new EventFlow event staff invitation.",
      badge: "Staff invitation",
      tone: "security",
      details: [
        { label: "Invitation token", value: token, code: true },
        {
          label: "Temporary password",
          value: temporaryPassword,
          code: true,
        },
        { label: "Expires", value: "48 hours" },
      ],
      highlightTitle: "Keep these credentials private",
      highlightText:
        "The invitation token and temporary password grant access to your staff account. Do not share them with anyone.",
    }),
  });

  return {
    staff,
    temporaryPassword,
    invitationToken: token,
  };
};

const accept = async (token: string) => {
  const staff = await prisma.eventStaff.findUnique({
    where: { invitationTokenHash: sha256(token) },
  });

  if (
    !staff ||
    staff.invitationStatus !== StaffInvitationStatus.PENDING ||
    !staff.invitationExpiresAt ||
    staff.invitationExpiresAt <= new Date()
  ) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invitation is invalid or expired");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.eventStaff.update({
      where: { id: staff.id },
      data: {
        invitationStatus: StaffInvitationStatus.ACCEPTED,
        acceptedAt: new Date(),
        invitationTokenHash: null,
      },
    });

    await tx.eventStaffAssignment.updateMany({
      where: { eventStaffId: staff.id },
      data: { isActive: true },
    });

    return updated;
  });
};

const list = async (userId: string) => {
  const organizer = await getOrganizer(userId);
  return prisma.eventStaff.findMany({
    where: { invitedByOrganizerId: organizer.id },
    include: {
      user: { omit: { password: true } },
      assignments: {
        include: { event: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

const assign = async (
  userId: string,
  staffId: string,
  eventIds: string[],
) => {
  const organizer = await getOrganizer(userId);
  await verifyEventsOwned(organizer.id, eventIds);

  const staff = await prisma.eventStaff.findFirst({
    where: {
      id: staffId,
      invitedByOrganizerId: organizer.id,
      invitationStatus: StaffInvitationStatus.ACCEPTED,
    },
  });
  if (!staff) throw new AppError(httpStatus.NOT_FOUND, "Active staff member not found");

  for (const eventId of eventIds) {
    await prisma.eventStaffAssignment.upsert({
      where: {
        eventStaffId_eventId: { eventStaffId: staff.id, eventId },
      },
      create: {
        eventStaffId: staff.id,
        eventId,
        assignedByOrganizerId: organizer.id,
        isActive: true,
      },
      update: { isActive: true },
    });
  }

  return prisma.eventStaff.findUnique({
    where: { id: staff.id },
    include: { assignments: { include: { event: true } } },
  });
};

const revoke = async (userId: string, staffId: string) => {
  const organizer = await getOrganizer(userId);
  const staff = await prisma.eventStaff.findFirst({
    where: { id: staffId, invitedByOrganizerId: organizer.id },
  });
  if (!staff) throw new AppError(httpStatus.NOT_FOUND, "Staff member not found");

  await prisma.$transaction([
    prisma.eventStaff.update({
      where: { id: staff.id },
      data: { invitationStatus: StaffInvitationStatus.REVOKED },
    }),
    prisma.eventStaffAssignment.updateMany({
      where: { eventStaffId: staff.id },
      data: { isActive: false },
    }),
    prisma.session.updateMany({
      where: { userId: staff.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  return { revoked: true };
};

const myAssignments = async (userId: string) => {
  const staff = await prisma.eventStaff.findUnique({ where: { userId } });
  if (!staff || staff.invitationStatus !== StaffInvitationStatus.ACCEPTED) {
    throw new AppError(httpStatus.FORBIDDEN, "Event staff account is inactive");
  }

  return prisma.eventStaffAssignment.findMany({
    where: { eventStaffId: staff.id, isActive: true },
    include: { event: true },
    orderBy: { createdAt: "desc" },
  });
};

export const StaffService = {
  invite,
  accept,
  list,
  assign,
  revoke,
  myAssignments,
};
