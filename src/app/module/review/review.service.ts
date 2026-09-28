import httpStatus from "http-status";
import {
  EventStatus,
  ReviewStatus,
  TicketStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";

const getAttendee = async (userId: string) => {
  const attendee = await prisma.attendee.findUnique({ where: { userId } });
  if (!attendee) throw new AppError(httpStatus.FORBIDDEN, "Attendee required");
  return attendee;
};

const create = async (
  userId: string,
  payload: { eventId: string; rating: number; comment: string; images: string[] },
) => {
  const attendee = await getAttendee(userId);
  const event = await prisma.event.findUnique({ where: { id: payload.eventId } });
  if (!event || event.status !== EventStatus.COMPLETED) {
    throw new AppError(httpStatus.CONFLICT, "Reviews are available only after event completion");
  }

  const eligibleTicket = await prisma.ticket.findFirst({
    where: {
      eventId: event.id,
      ownerId: attendee.id,
      status: {
        notIn: [TicketStatus.REFUNDED, TicketStatus.CANCELLED, TicketStatus.VOID],
      },
    },
  });
  if (!eligibleTicket) {
    throw new AppError(httpStatus.FORBIDDEN, "A non-refunded event ticket is required to review");
  }

  return prisma.review.create({
    data: {
      attendeeId: attendee.id,
      eventId: event.id,
      organizerId: event.organizerId,
      rating: payload.rating,
      comment: payload.comment,
      images: payload.images,
    },
  });
};

const eventReviews = async (eventId: string) => {
  const [reviews, stats] = await prisma.$transaction([
    prisma.review.findMany({
      where: { eventId, status: ReviewStatus.VISIBLE },
      include: {
        attendee: {
          select: {
            user: {
              select: { name: true, imageUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.review.aggregate({
      where: { eventId, status: ReviewStatus.VISIBLE },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ]);

  return {
    reviews,
    averageRating: stats._avg.rating ?? 0,
    totalReviews: stats._count.rating,
  };
};

const moderate = async (reviewId: string, status: ReviewStatus) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new AppError(httpStatus.NOT_FOUND, "Review not found");

  return prisma.review.update({
    where: { id: reviewId },
    data: { status },
  });
};

export const ReviewService = { create, eventReviews, moderate };
