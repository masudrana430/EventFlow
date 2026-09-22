import crypto from "node:crypto";
import httpStatus from "http-status";
import {
  DiscountType,
  EventStatus,
  OrderStatus,
  PaymentStatus,
  ReservationStatus,
  TicketStatus,
  UserRole,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import {
  createUddoktaPayment,
  verifyUddoktaPayment,
  type UddoktaVerifyResponse,
} from "../../lib/uddoktapay";
import { AppError } from "../../utils/AppError";
import { safeSendEmail } from "../../utils/email";
import { renderTransactionalEmail } from "../../utils/emailTemplates";
import { createNotification } from "../../utils/notification";
import {
  orderNumber,
  sha256,
  signTicketPayload,
  ticketNumber,
} from "../../utils/security";

const getAttendee = async (userId: string) => {
  const attendee = await prisma.attendee.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!attendee) {
    throw new AppError(httpStatus.FORBIDDEN, "Attendee account required");
  }
  return attendee;
};

const calculatePromo = async (
  promoInput: string | undefined,
  eventId: string,
  attendeeId: string,
  subtotal: number,
) => {
  if (!promoInput) return { promo: null, discount: 0 };

  const promo = await prisma.promoCode.findUnique({
    where: { code: promoInput.toUpperCase() },
  });

  const now = new Date();
  if (
    !promo ||
    promo.eventId !== eventId ||
    !promo.isActive ||
    promo.startAt > now ||
    promo.endAt < now ||
    (promo.maxUses !== null && promo.usedCount >= promo.maxUses) ||
    (promo.minOrderAmount !== null &&
      subtotal < Number(promo.minOrderAmount))
  ) {
    throw new AppError(httpStatus.BAD_REQUEST, "Promo code is invalid or unavailable");
  }

  const alreadyUsed = await prisma.promoCodeRedemption.findFirst({
    where: { promoCodeId: promo.id, attendeeId },
  });
  if (alreadyUsed) {
    throw new AppError(httpStatus.CONFLICT, "You already used this promo code");
  }

  const raw =
    promo.discountType === DiscountType.PERCENTAGE
      ? subtotal * (Number(promo.value) / 100)
      : Number(promo.value);

  return {
    promo,
    discount: Math.min(raw, subtotal),
  };
};

const createTickets = async (
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  order: {
    id: string;
    eventId: string;
    attendeeId: string;
    items: Array<{ ticketTypeId: string; quantity: number }>;
  },
) => {
  const created = [];

  for (const item of order.items) {
    for (let index = 0; index < item.quantity; index += 1) {
      const id = crypto.randomUUID();
      const payload = signTicketPayload(id, order.eventId);

      created.push(
        await tx.ticket.create({
          data: {
            id,
            ticketNumber: ticketNumber(),
            orderId: order.id,
            eventId: order.eventId,
            ticketTypeId: item.ticketTypeId,
            ownerId: order.attendeeId,
            qrPayload: payload,
            qrTokenHash: sha256(payload),
            status: TicketStatus.VALID,
          },
        }),
      );
    }
  }

  return created;
};

const finalizeFreeOrder = async (orderId: string) =>
  prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, reservation: true, payment: true },
    });
    if (!order) throw new AppError(httpStatus.NOT_FOUND, "Order not found");

    if (order.status === OrderStatus.PAID) {
      return tx.order.findUnique({
        where: { id: orderId },
        include: { tickets: true, payment: true },
      });
    }

    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: OrderStatus.PENDING },
      data: { status: OrderStatus.PAID, paidAt: new Date() },
    });
    if (!claimed.count) {
      throw new AppError(httpStatus.CONFLICT, "Order is no longer payable");
    }

    const reservationClaimed = await tx.ticketReservation.updateMany({
      where: {
        id: order.reservationId,
        status: ReservationStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      data: { status: ReservationStatus.CONVERTED },
    });

    if (!reservationClaimed.count) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Ticket reservation expired before confirmation",
      );
    }

    await tx.ticketType.update({
      where: { id: order.reservation.ticketTypeId },
      data: {
        reservedQuantity: { decrement: order.reservation.quantity },
        soldQuantity: { increment: order.reservation.quantity },
      },
    });

    await tx.payment.update({
      where: { orderId: order.id },
      data: {
        status: PaymentStatus.PAID,
        paidAt: new Date(),
        verifiedAt: new Date(),
      },
    });

    const tickets = await createTickets(tx as never, {
      id: order.id,
      eventId: order.eventId,
      attendeeId: order.attendeeId,
      items: order.items,
    });

    return { ...order, tickets };
  });

const checkout = async (
  userId: string,
  payload: { ticketTypeId: string; quantity: number; promoCode?: string },
) => {
  const attendee = await getAttendee(userId);
  const type = await prisma.ticketType.findUnique({
    where: { id: payload.ticketTypeId },
    include: { event: true },
  });

  if (!type || type.isDeleted || !type.isVisible) {
    throw new AppError(httpStatus.NOT_FOUND, "Ticket type not found");
  }

  const now = new Date();
  if (
    type.event.status !== EventStatus.PUBLISHED ||
    type.event.startDateTime <= now ||
    type.event.saleStartAt > now ||
    type.event.saleEndAt < now ||
    type.saleStartAt > now ||
    type.saleEndAt < now
  ) {
    throw new AppError(httpStatus.CONFLICT, "Tickets are not on sale");
  }

  if (payload.quantity > type.maxPerOrder) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Maximum ${type.maxPerOrder} tickets are allowed per order`,
    );
  }

  const subtotal = Number(type.price) * payload.quantity;
  const { promo, discount } = await calculatePromo(
    payload.promoCode,
    type.eventId,
    attendee.id,
    subtotal,
  );
  const serviceFee = Number(
    ((subtotal - discount) * (config.service_fee_percent / 100)).toFixed(2),
  );
  const total = Number((subtotal - discount + serviceFee).toFixed(2));
  const expiresAt = new Date(
    Date.now() + config.reservation_minutes * 60 * 1000,
  );
  const number = orderNumber();

  const order = await prisma.$transaction(async (tx) => {
    const updated = await tx.$executeRawUnsafe(
      'UPDATE "TicketType" SET "reservedQuantity" = "reservedQuantity" + $1, "updatedAt" = NOW() WHERE "id" = $2 AND ("quantity" - "soldQuantity" - "reservedQuantity") >= $1',
      payload.quantity,
      type.id,
    );

    if (!Number(updated)) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Not enough ticket inventory is available",
      );
    }

    const reservation = await tx.ticketReservation.create({
      data: {
        attendeeId: attendee.id,
        eventId: type.eventId,
        ticketTypeId: type.id,
        quantity: payload.quantity,
        expiresAt,
      },
    });

    return tx.order.create({
      data: {
        orderNumber: number,
        attendeeId: attendee.id,
        eventId: type.eventId,
        reservationId: reservation.id,
        promoCodeId: promo?.id,
        subtotal,
        serviceFee,
        discount,
        total,
        expiresAt,
        items: {
          create: {
            ticketTypeId: type.id,
            ticketTypeName: type.name,
            unitPrice: type.price,
            quantity: payload.quantity,
            lineTotal: subtotal,
          },
        },
        payment: {
          create: {
            gateway: total === 0 ? "FREE" : "UDDOKTAPAY",
            invoiceId: `LOCAL-${number}`,
            amount: total,
            status: PaymentStatus.PENDING,
          },
        },
      },
      include: {
        items: true,
        payment: true,
        reservation: true,
      },
    });
  });

  if (total === 0) {
    const completed = await finalizeFreeOrder(order.id);
    await createNotification({
      userId,
      type: "ORDER_PAID",
      title: "Free ticket confirmed",
      message: `Your order ${number} is confirmed.`,
      resourceType: "Order",
      resourceId: order.id,
    });
    return { order: completed, paymentUrl: null };
  }

  try {
    const payment = await createUddoktaPayment({
      full_name: attendee.user.name,
      email: attendee.user.email,
      amount: total.toFixed(2),
      metadata: {
        order_id: order.id,
        order_number: order.orderNumber,
      },
      redirect_url: `${config.backend_url}/api/v1/payment/uddoktapay/callback`,
      cancel_url: `${config.backend_url}/api/v1/payment/uddoktapay/cancel`,
      webhook_url: `${config.backend_url}/api/v1/payment/uddoktapay/webhook`,
    });

    if (payment.invoice_id) {
      await prisma.payment.update({
        where: { orderId: order.id },
        data: { invoiceId: payment.invoice_id },
      });
    }

    return {
      order,
      paymentUrl: payment.payment_url,
      invoiceId: payment.invoice_id ?? null,
    };
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      const released = await tx.ticketReservation.updateMany({
        where: {
          id: order.reservationId,
          status: ReservationStatus.ACTIVE,
        },
        data: { status: ReservationStatus.CANCELLED },
      });

      if (released.count) {
        await tx.ticketType.update({
          where: { id: type.id },
          data: { reservedQuantity: { decrement: payload.quantity } },
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAYMENT_FAILED },
      });
      await tx.payment.update({
        where: { orderId: order.id },
        data: { status: PaymentStatus.FAILED },
      });
    });

    throw error;
  }
};

const verifyAndFinalize = async (invoiceId: string) => {
  const verified = await verifyUddoktaPayment(invoiceId);

  if (String(verified.status).toUpperCase() !== "COMPLETED") {
    throw new AppError(httpStatus.BAD_REQUEST, "Payment is not completed");
  }

  const orderId = String(verified.metadata?.order_id ?? "");
  if (!orderId) {
    throw new AppError(httpStatus.BAD_GATEWAY, "Payment metadata is missing order ID");
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payment: true,
      reservation: true,
      items: true,
      attendee: { include: { user: true } },
      event: true,
      tickets: true,
    },
  });

  if (!order?.payment) {
    throw new AppError(httpStatus.NOT_FOUND, "Local payment record not found");
  }

  if (
    order.status === OrderStatus.PAID &&
    order.payment.status === PaymentStatus.PAID
  ) {
    return { order, alreadyProcessed: true };
  }

  if (order.expiresAt <= new Date()) {
    throw new AppError(httpStatus.CONFLICT, "Order reservation has expired");
  }

  const verifiedAmount = Number(verified.amount);
  if (
    !Number.isFinite(verifiedAmount) ||
    Math.abs(verifiedAmount - Number(order.total)) > 0.01
  ) {
    throw new AppError(httpStatus.BAD_GATEWAY, "Verified payment amount does not match order total");
  }

  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: {
        id: order.payment!.id,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.PAID,
        invoiceId: String(verified.invoice_id ?? invoiceId),
        transactionId: verified.transaction_id
          ? String(verified.transaction_id)
          : undefined,
        paymentMethod: verified.payment_method
          ? String(verified.payment_method)
          : undefined,
        gatewayResponse: verified as object,
        verifiedAt: new Date(),
        paidAt: new Date(),
      },
    });

    if (!claimed.count) {
      const updatedOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: {
          payment: true,
          tickets: true,
          items: true,
          event: true,
        },
      });
      return {
        updatedOrder,
        tickets: updatedOrder?.tickets ?? [],
      };
    }

    const orderClaimed = await tx.order.updateMany({
      where: {
        id: order.id,
        status: OrderStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      data: {
        status: OrderStatus.PAID,
        paidAt: new Date(),
      },
    });

    const reservationClaimed = await tx.ticketReservation.updateMany({
      where: {
        id: order.reservationId,
        status: ReservationStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      data: { status: ReservationStatus.CONVERTED },
    });

    if (!orderClaimed.count || !reservationClaimed.count) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Order reservation expired before payment verification completed",
      );
    }

    await tx.ticketType.update({
      where: { id: order.reservation.ticketTypeId },
      data: {
        reservedQuantity: { decrement: order.reservation.quantity },
        soldQuantity: { increment: order.reservation.quantity },
      },
    });

    if (order.promoCodeId) {
      await tx.promoCode.update({
        where: { id: order.promoCodeId },
        data: { usedCount: { increment: 1 } },
      });
      await tx.promoCodeRedemption.create({
        data: {
          promoCodeId: order.promoCodeId,
          attendeeId: order.attendeeId,
          orderId: order.id,
        },
      });
    }

    const tickets = await createTickets(tx as never, {
      id: order.id,
      eventId: order.eventId,
      attendeeId: order.attendeeId,
      items: order.items,
    });

    const updatedOrder = await tx.order.findUnique({
      where: { id: order.id },
      include: {
        payment: true,
        tickets: true,
        items: true,
        event: true,
      },
    });

    return { updatedOrder, tickets };
  });

  await createNotification({
    userId: order.attendee.userId,
    type: "ORDER_PAID",
    title: "Ticket purchase completed",
    message: `Payment for order ${order.orderNumber} was verified successfully.`,
    resourceType: "Order",
    resourceId: order.id,
  });

  void safeSendEmail({
    to: order.attendee.user.email,
    subject: `EventFlow order ${order.orderNumber} confirmed`,
    html: await renderTransactionalEmail({
      name: order.attendee.user.name,
      heading: "Payment confirmed — your tickets are ready",
      message:
        "Your payment was verified successfully. Your EventFlow order is confirmed and your digital tickets are now available.",
      preheader: `Order ${order.orderNumber} for ${order.event.title} is confirmed.`,
      badge: "Payment confirmed",
      tone: "success",
      details: [
        { label: "Order", value: order.orderNumber, code: true },
        { label: "Event", value: order.event.title },
      ],
      highlightTitle: "Keep your digital tickets handy",
      highlightText:
        "Open EventFlow before arriving at the venue so your ticket QR code is ready for check-in.",
    }),
  });

  if (!result.updatedOrder) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Order disappeared during payment processing",
    );
  }

  return { order: result.updatedOrder, alreadyProcessed: false };
};

const cancelGatewayPayment = async (invoiceId?: string) => {
  if (!invoiceId) return null;

  const payment = await prisma.payment.findUnique({
    where: { invoiceId },
    include: { order: { include: { reservation: true } } },
  });
  if (!payment || payment.status !== PaymentStatus.PENDING) return payment;

  await prisma.$transaction(async (tx) => {
    const released = await tx.ticketReservation.updateMany({
      where: {
        id: payment.order.reservationId,
        status: ReservationStatus.ACTIVE,
      },
      data: { status: ReservationStatus.CANCELLED },
    });

    if (released.count) {
      await tx.ticketType.update({
        where: { id: payment.order.reservation.ticketTypeId },
        data: {
          reservedQuantity: {
            decrement: payment.order.reservation.quantity,
          },
        },
      });
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.CANCELLED },
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: OrderStatus.CANCELLED },
    });
  });

  return payment;
};

const myOrders = async (userId: string) => {
  const attendee = await getAttendee(userId);
  return prisma.order.findMany({
    where: { attendeeId: attendee.id },
    include: {
      event: true,
      items: true,
      payment: true,
      tickets: true,
    },
    orderBy: { createdAt: "desc" },
  });
};

const getMyOrder = async (userId: string, orderId: string) => {
  const attendee = await getAttendee(userId);
  const order = await prisma.order.findFirst({
    where: { id: orderId, attendeeId: attendee.id },
    include: {
      event: true,
      items: true,
      payment: true,
      tickets: true,
      refunds: true,
    },
  });
  if (!order) throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  return order;
};

const allPayments = async () =>
  prisma.payment.findMany({
    include: {
      order: {
        include: {
          attendee: { include: { user: { omit: { password: true } } } },
          event: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

const myPayments = async (userId: string) => {
  const attendee = await getAttendee(userId);
  return prisma.payment.findMany({
    where: { order: { attendeeId: attendee.id } },
    include: { order: { include: { event: true } } },
    orderBy: { createdAt: "desc" },
  });
};

export const OrderService = {
  checkout,
  verifyAndFinalize,
  cancelGatewayPayment,
  myOrders,
  getMyOrder,
  allPayments,
  myPayments,
};
