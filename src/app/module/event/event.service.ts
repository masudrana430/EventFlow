import httpStatus from "http-status";
import {
  EventStatus,
  OrganizerApprovalStatus,
  UserRole,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { safeDestroyAsset, uploadBuffer } from "../../lib/upload";
import { AppError } from "../../utils/AppError";
import { writeAuditLog } from "../../utils/audit";
import { createNotification } from "../../utils/notification";
import { slugify } from "../../utils/slug";

type EventInput = {
  categoryId: string;
  title: string;
  shortDescription: string;
  description: string;
  venueName: string;
  venueAddress: string;
  latitude?: number;
  longitude?: number;
  startDateTime: string;
  endDateTime: string;
  entryOpenTime: string;
  saleStartAt: string;
  saleEndAt: string;
  contactEmail: string;
  contactPhone?: string;
  ageRestriction?: number;
  policies?: string[];
  refundPolicyType?: "DEFAULT" | "FULL_UNTIL" | "PARTIAL_UNTIL" | "NON_REFUNDABLE" | "ORGANIZER_APPROVAL";
  refundDeadline?: string;
  refundPercentage?: number;
  capacity: number;
  publishAt?: string;
};

const getApprovedOrganizer = async (userId: string) => {
  const organizer = await prisma.organizer.findUnique({ where: { userId } });
  if (!organizer) {
    throw new AppError(httpStatus.NOT_FOUND, "Organizer profile not found");
  }
  if (organizer.approvalStatus !== OrganizerApprovalStatus.APPROVED) {
    throw new AppError(httpStatus.FORBIDDEN, "Organizer account is not approved");
  }
  return organizer;
};

const normalizeEventData = (payload: Partial<EventInput>) => ({
  ...payload,
  ...(payload.startDateTime ? { startDateTime: new Date(payload.startDateTime) } : {}),
  ...(payload.endDateTime ? { endDateTime: new Date(payload.endDateTime) } : {}),
  ...(payload.entryOpenTime ? { entryOpenTime: new Date(payload.entryOpenTime) } : {}),
  ...(payload.saleStartAt ? { saleStartAt: new Date(payload.saleStartAt) } : {}),
  ...(payload.saleEndAt ? { saleEndAt: new Date(payload.saleEndAt) } : {}),
  ...(payload.refundDeadline ? { refundDeadline: new Date(payload.refundDeadline) } : {}),
  ...(payload.publishAt ? { publishAt: new Date(payload.publishAt) } : {}),
});

const validateDates = (payload: EventInput) => {
  const start = new Date(payload.startDateTime);
  const end = new Date(payload.endDateTime);
  const entry = new Date(payload.entryOpenTime);
  const saleStart = new Date(payload.saleStartAt);
  const saleEnd = new Date(payload.saleEndAt);

  if (start <= new Date()) {
    throw new AppError(httpStatus.BAD_REQUEST, "Event start time must be in the future");
  }
  if (end <= start) {
    throw new AppError(httpStatus.BAD_REQUEST, "Event end time must be after start time");
  }
  if (entry > start) {
    throw new AppError(httpStatus.BAD_REQUEST, "Entry opening time cannot be after event start");
  }
  if (saleEnd <= saleStart) {
    throw new AppError(httpStatus.BAD_REQUEST, "Ticket sale end must be after sale start");
  }
  if (saleEnd >= start) {
    throw new AppError(httpStatus.BAD_REQUEST, "Ticket sales must end before event starts");
  }
  if (payload.refundDeadline && new Date(payload.refundDeadline) >= start) {
    throw new AppError(httpStatus.BAD_REQUEST, "Refund deadline must be before event start");
  }
};

const create = async (userId: string, payload: EventInput) => {
  const organizer = await getApprovedOrganizer(userId);
  validateDates(payload);

  const category = await prisma.eventCategory.findFirst({
    where: { id: payload.categoryId, isActive: true },
  });
  if (!category) {
    throw new AppError(httpStatus.BAD_REQUEST, "Active category not found");
  }

  const slug = `${slugify(payload.title)}-${Date.now().toString(36)}`;

  return prisma.event.create({
    data: {
      ...normalizeEventData(payload),
      organizerId: organizer.id,
      slug,
    } as never,
    include: { category: true },
  });
};

const getOwnedEvent = async (userId: string, eventId: string) => {
  const organizer = await getApprovedOrganizer(userId);
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizerId: organizer.id, isDeleted: false },
    include: {
      ticketTypes: { where: { isDeleted: false } },
      category: true,
    },
  });

  if (!event) throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  return event;
};

const update = async (
  userId: string,
  eventId: string,
  payload: Partial<EventInput>,
) => {
  const event = await getOwnedEvent(userId, eventId);

  if (
    event.status === EventStatus.PENDING_REVIEW ||
    event.status === EventStatus.COMPLETED ||
    event.status === EventStatus.CANCELLED
  ) {
    throw new AppError(httpStatus.CONFLICT, "This event cannot be edited in its current status");
  }

  const hasSales = event.ticketTypes.some((ticketType) => ticketType.soldQuantity > 0);

  if (hasSales) {
    const locked = [
      "title",
      "startDateTime",
      "endDateTime",
      "venueName",
      "venueAddress",
      "refundPolicyType",
      "refundDeadline",
      "refundPercentage",
    ];
    if (locked.some((field) => field in payload)) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Critical event details are locked after the first ticket sale",
      );
    }
  }

  if (
    (event.status === EventStatus.APPROVED ||
      event.status === EventStatus.PUBLISHED ||
      event.status === EventStatus.ONGOING) &&
    payload.categoryId
  ) {
    throw new AppError(httpStatus.CONFLICT, "Category is locked after approval");
  }

  if (new Date() >= event.startDateTime) {
    const lockedAfterStart = ["description", "shortDescription"];
    if (lockedAfterStart.some((field) => field in payload)) {
      throw new AppError(httpStatus.CONFLICT, "Event content is locked after event start");
    }
  }

  const merged: EventInput = {
    categoryId: payload.categoryId ?? event.categoryId,
    title: payload.title ?? event.title,
    shortDescription: payload.shortDescription ?? event.shortDescription,
    description: payload.description ?? event.description,
    venueName: payload.venueName ?? event.venueName,
    venueAddress: payload.venueAddress ?? event.venueAddress,
    latitude: payload.latitude ?? event.latitude ?? undefined,
    longitude: payload.longitude ?? event.longitude ?? undefined,
    startDateTime: (payload.startDateTime ?? event.startDateTime.toISOString()),
    endDateTime: (payload.endDateTime ?? event.endDateTime.toISOString()),
    entryOpenTime: (payload.entryOpenTime ?? event.entryOpenTime.toISOString()),
    saleStartAt: (payload.saleStartAt ?? event.saleStartAt.toISOString()),
    saleEndAt: (payload.saleEndAt ?? event.saleEndAt.toISOString()),
    contactEmail: payload.contactEmail ?? event.contactEmail,
    contactPhone: payload.contactPhone ?? event.contactPhone ?? undefined,
    ageRestriction: payload.ageRestriction ?? event.ageRestriction ?? undefined,
    policies: payload.policies ?? event.policies,
    refundPolicyType: payload.refundPolicyType ?? event.refundPolicyType,
    refundDeadline:
      payload.refundDeadline ?? event.refundDeadline?.toISOString(),
    refundPercentage:
      payload.refundPercentage ?? event.refundPercentage ?? undefined,
    capacity: payload.capacity ?? event.capacity,
    publishAt: payload.publishAt ?? event.publishAt?.toISOString(),
  };

  validateDates(merged);

  const inventory = event.ticketTypes.reduce((sum, item) => sum + item.quantity, 0);
  if (merged.capacity < inventory) {
    throw new AppError(
      httpStatus.CONFLICT,
      "Venue capacity cannot be lower than existing ticket inventory",
    );
  }

  return prisma.event.update({
    where: { id: eventId },
    data: normalizeEventData(payload) as never,
    include: { category: true, ticketTypes: true },
  });
};

const uploadCover = async (
  userId: string,
  eventId: string,
  file: Express.Multer.File,
) => {
  const event = await getOwnedEvent(userId, eventId);

  if (!file.mimetype.startsWith("image/")) {
    throw new AppError(httpStatus.BAD_REQUEST, "Cover must be an image");
  }

  if (new Date() >= event.startDateTime) {
    throw new AppError(httpStatus.CONFLICT, "Cover image is locked after event start");
  }

  const uploaded = await uploadBuffer(file.buffer, {
    folder: "eventflow/events/covers",
    resource_type: "image",
  });

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      coverImageUrl: uploaded.secure_url,
      coverImagePublicId: uploaded.public_id,
    },
  });

  await safeDestroyAsset(event.coverImagePublicId);
  return updated;
};

const uploadGallery = async (
  userId: string,
  eventId: string,
  files: Express.Multer.File[],
) => {
  const event = await getOwnedEvent(userId, eventId);
  if (!files.length) {
    throw new AppError(httpStatus.BAD_REQUEST, "At least one image is required");
  }

  const urls = [...event.galleryUrls];
  for (const file of files.slice(0, 8)) {
    if (!file.mimetype.startsWith("image/")) continue;
    const uploaded = await uploadBuffer(file.buffer, {
      folder: "eventflow/events/gallery",
      resource_type: "image",
    });
    urls.push(uploaded.secure_url);
  }

  return prisma.event.update({
    where: { id: eventId },
    data: { galleryUrls: urls.slice(0, 12) },
  });
};

const submitForReview = async (userId: string, eventId: string) => {
  const event = await getOwnedEvent(userId, eventId);

  if (
    event.status !== EventStatus.DRAFT &&
    event.status !== EventStatus.CHANGES_REQUESTED &&
    event.status !== EventStatus.REJECTED
  ) {
    throw new AppError(httpStatus.CONFLICT, "Event cannot be submitted from its current status");
  }

  if (!event.coverImageUrl) {
    throw new AppError(httpStatus.BAD_REQUEST, "Event cover image is required");
  }

  if (!event.ticketTypes.length) {
    throw new AppError(httpStatus.BAD_REQUEST, "Create at least one ticket type before review");
  }

  const inventory = event.ticketTypes.reduce((sum, type) => sum + type.quantity, 0);
  if (inventory > event.capacity) {
    throw new AppError(httpStatus.CONFLICT, "Ticket inventory exceeds venue capacity");
  }

  return prisma.event.update({
    where: { id: eventId },
    data: {
      status: EventStatus.PENDING_REVIEW,
      submittedAt: new Date(),
      rejectionReason: null,
      requestedChanges: null,
    },
  });
};

const adminList = async (query: Record<string, unknown>) => {
  const page = Math.max(Number(query.page ?? 1), 1);
  const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);
  const status = query.status as EventStatus | undefined;

  const where = {
    isDeleted: false,
    ...(status ? { status } : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.event.findMany({
      where,
      include: {
        organizer: { include: { user: { omit: { password: true } } } },
        category: true,
        ticketTypes: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const review = async (
  actorUserId: string,
  eventId: string,
  decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED",
  reason?: string,
) => {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { organizer: { include: { user: true } } },
  });

  if (!event) throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  if (event.status !== EventStatus.PENDING_REVIEW) {
    throw new AppError(httpStatus.CONFLICT, "Only pending events can be reviewed");
  }

  if (decision !== "APPROVED" && !reason) {
    throw new AppError(httpStatus.BAD_REQUEST, "A reason is required");
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data:
      decision === "APPROVED"
        ? {
            status: EventStatus.APPROVED,
            approvedAt: new Date(),
            rejectionReason: null,
            requestedChanges: null,
          }
        : decision === "REJECTED"
          ? {
              status: EventStatus.REJECTED,
              rejectionReason: reason,
            }
          : {
              status: EventStatus.CHANGES_REQUESTED,
              requestedChanges: reason,
            },
  });

  await writeAuditLog({
    actorUserId,
    action: `EVENT_${decision}`,
    targetType: "Event",
    targetId: eventId,
    previousValue: { status: event.status },
    newValue: { status: updated.status, reason },
  });

  await createNotification({
    userId: event.organizer.userId,
    type: "EVENT_REVIEW",
    title: `Event ${decision.toLowerCase().replace("_", " ")}`,
    message:
      decision === "APPROVED"
        ? `${event.title} was approved and is ready to publish.`
        : `${event.title}: ${reason}`,
    resourceType: "Event",
    resourceId: eventId,
  });

  return updated;
};

const publish = async (userId: string, eventId: string) => {
  const event = await getOwnedEvent(userId, eventId);

  if (event.status !== EventStatus.APPROVED) {
    throw new AppError(httpStatus.CONFLICT, "Only approved events can be published");
  }

  if (event.publishAt && event.publishAt > new Date()) {
    return event;
  }

  return prisma.event.update({
    where: { id: eventId },
    data: {
      status: EventStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });
};

const cancel = async (
  userId: string,
  eventId: string,
  reason: string,
  role: UserRole,
) => {
  const event =
    role === UserRole.ORGANIZER
      ? await getOwnedEvent(userId, eventId)
      : await prisma.event.findUnique({
          where: { id: eventId },
          include: { ticketTypes: true, category: true },
        });

  if (!event) throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  if (event.status === EventStatus.COMPLETED) {
    throw new AppError(httpStatus.CONFLICT, "Completed events cannot be cancelled");
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      status: EventStatus.CANCELLED,
      cancellationReason: reason,
      cancelledAt: new Date(),
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.ticket.updateMany({
      where: { eventId, status: "VALID" },
      data: { status: "CANCELLED" },
    });

    const paidOrders = await tx.order.findMany({
      where: {
        eventId,
        status: {
          in: ["PAID", "COMPLETED", "PARTIALLY_REFUNDED"],
        },
      },
      include: {
        refunds: true,
      },
    });

    for (const order of paidOrders) {
      const hasCancellationRefund = order.refunds.some(
        (refund) =>
          refund.ticketId === null &&
          ["REQUESTED", "APPROVED", "PROCESSING", "REFUNDED"].includes(
            refund.status,
          ),
      );

      if (hasCancellationRefund) continue;

      await tx.refund.create({
        data: {
          orderId: order.id,
          eventId,
          attendeeId: order.attendeeId,
          reason: `Event cancelled: ${reason}`,
          requestedAmount: order.total,
          approvedAmount: order.total,
          status: "PROCESSING",
          decisionByUserId: userId,
          decisionReason:
            "Full refund automatically approved because the event was cancelled",
        },
      });
    }
  });

  await writeAuditLog({
    actorUserId: userId,
    action: "EVENT_CANCELLED",
    targetType: "Event",
    targetId: eventId,
    previousValue: { status: event.status },
    newValue: { status: updated.status, reason },
  });

  return updated;
};

const suspend = async (
  actorUserId: string,
  eventId: string,
  reason: string,
) => {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new AppError(httpStatus.NOT_FOUND, "Event not found");

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      status: EventStatus.SUSPENDED,
      suspendedReason: reason,
    },
  });

  await writeAuditLog({
    actorUserId,
    action: "EVENT_SUSPENDED",
    targetType: "Event",
    targetId: eventId,
    previousValue: { status: event.status },
    newValue: { status: updated.status, reason },
  });

  return updated;
};

const restore = async (actorUserId: string, eventId: string) => {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new AppError(httpStatus.NOT_FOUND, "Event not found");
  if (event.status !== EventStatus.SUSPENDED) {
    throw new AppError(httpStatus.CONFLICT, "Event is not suspended");
  }

  const status =
    event.startDateTime <= new Date()
      ? EventStatus.ONGOING
      : EventStatus.PUBLISHED;

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      status,
      suspendedReason: null,
    },
  });

  await writeAuditLog({
    actorUserId,
    action: "EVENT_RESTORED",
    targetType: "Event",
    targetId: eventId,
    previousValue: { status: event.status },
    newValue: { status },
  });

  return updated;
};

const myEvents = async (userId: string) => {
  const organizer = await getApprovedOrganizer(userId);
  return prisma.event.findMany({
    where: { organizerId: organizer.id, isDeleted: false },
    include: { category: true, ticketTypes: true },
    orderBy: { createdAt: "desc" },
  });
};

const publicList = async (query: Record<string, unknown>) => {
  const page = Math.max(Number(query.page ?? 1), 1);
  const limit = Math.min(Math.max(Number(query.limit ?? 12), 1), 50);
  const searchTerm = String(query.searchTerm ?? "").trim();
  const location = String(query.location ?? "").trim();
  const categoryId = query.categoryId ? String(query.categoryId) : undefined;

  const where = {
    status: EventStatus.PUBLISHED,
    isDeleted: false,
    endDateTime: { gt: new Date() },
    ...(categoryId ? { categoryId } : {}),
    ...(searchTerm
      ? {
          OR: [
            { title: { contains: searchTerm, mode: "insensitive" as const } },
            { shortDescription: { contains: searchTerm, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(location
      ? {
          venueAddress: { contains: location, mode: "insensitive" as const },
        }
      : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.event.findMany({
      where,
      include: {
        category: true,
        organizer: {
          select: {
            id: true,
            organizationName: true,
          },
        },
        ticketTypes: {
          where: { isDeleted: false, isVisible: true },
          select: {
            id: true,
            name: true,
            price: true,
            quantity: true,
            soldQuantity: true,
            reservedQuantity: true,
          },
        },
      },
      orderBy: { startDateTime: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

const publicDetails = async (eventIdOrSlug: string) => {
  const event = await prisma.event.findFirst({
    where: {
      OR: [{ id: eventIdOrSlug }, { slug: eventIdOrSlug }],
      status: EventStatus.PUBLISHED,
      isDeleted: false,
    },
    include: {
      category: true,
      organizer: {
        select: {
          id: true,
          organizationName: true,
        },
      },
      ticketTypes: {
        where: { isDeleted: false, isVisible: true },
      },
      reviews: {
        where: { status: "VISIBLE" },
        take: 10,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!event) throw new AppError(httpStatus.NOT_FOUND, "Published event not found");
  return event;
};

export const EventService = {
  create,
  update,
  uploadCover,
  uploadGallery,
  submitForReview,
  adminList,
  review,
  publish,
  cancel,
  suspend,
  restore,
  myEvents,
  publicList,
  publicDetails,
  getOwnedEvent,
};
