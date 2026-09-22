import httpStatus from "http-status";
import { TicketStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { safeSendEmail } from "../../utils/email";
import { renderTransactionalEmail } from "../../utils/emailTemplates";
import { EventService } from "../event/event.service";

const send = async (
  userId: string,
  payload: { eventId: string; title: string; message: string },
) => {
  const event = await EventService.getOwnedEvent(userId, payload.eventId);

  if (event.status === "CANCELLED" || event.status === "COMPLETED") {
    throw new AppError(
      httpStatus.CONFLICT,
      "Normal announcements cannot be sent for this event state",
    );
  }

  const announcement = await prisma.announcement.create({
    data: {
      eventId: payload.eventId,
      organizerId: event.organizerId,
      title: payload.title,
      message: payload.message,
      sentAt: new Date(),
    },
  });

  const attendees = await prisma.ticket.findMany({
    where: {
      eventId: payload.eventId,
      status: { in: [TicketStatus.VALID, TicketStatus.CHECKED_IN] },
    },
    select: {
      owner: {
        select: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      },
    },
    distinct: ["ownerId"],
  });

  await prisma.notification.createMany({
    data: attendees.map(({ owner }) => ({
      userId: owner.user.id,
      type: "EVENT_ANNOUNCEMENT",
      title: payload.title,
      message: payload.message,
      resourceType: "Event",
      resourceId: payload.eventId,
    })),
  });

  for (const { owner } of attendees) {
    void safeSendEmail({
      to: owner.user.email,
      subject: `${event.title}: ${payload.title}`,
      html: await renderTransactionalEmail({
        name: owner.user.name,
        heading: payload.title,
        message: payload.message,
        preheader: `${event.title}: ${payload.title}`,
        badge: "Event update",
        tone: "info",
        details: [{ label: "Event", value: event.title }],
        highlightTitle: "Organizer announcement",
        highlightText:
          "This message was sent by the event organizer to attendees with valid tickets.",
      }),
    });
  }

  return announcement;
};

const listForEvent = async (eventId: string) =>
  prisma.announcement.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
  });

export const AnnouncementService = { send, listForEvent };
