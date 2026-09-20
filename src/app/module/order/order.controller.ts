import httpStatus from "http-status";
import config from "../../config";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { OrderService } from "./order.service";

const checkout = catchAsync(async (req, res) => {
  const result = await OrderService.checkout(req.user!.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: result.paymentUrl
      ? "Checkout created"
      : "Free ticket order confirmed",
    data: result,
  });
});

const myOrders = catchAsync(async (req, res) => {
  const result = await OrderService.myOrders(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Orders retrieved",
    data: result,
  });
});

const getMyOrder = catchAsync(async (req, res) => {
  const result = await OrderService.getMyOrder(
    req.user!.userId,
    req.params.orderId,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Order retrieved",
    data: result,
  });
});

const callback = catchAsync(async (req, res) => {
  const invoiceId = String(req.query.invoice_id ?? "");
  const result = await OrderService.verifyAndFinalize(invoiceId);
  const orderId =
    "id" in (result.order as object)
      ? (result.order as { id?: string }).id
      : undefined;

  res.redirect(
    `${config.frontend_url}/dashboard/orders/${orderId ?? ""}?payment=success`,
  );
});

const webhook = catchAsync(async (req, res) => {
  const invoiceId = String(req.body?.invoice_id ?? req.query.invoice_id ?? "");
  const result = await OrderService.verifyAndFinalize(invoiceId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result.alreadyProcessed
      ? "Payment was already processed"
      : "Payment processed",
    data: null,
  });
});

const cancel = catchAsync(async (req, res) => {
  const invoiceId = req.query.invoice_id
    ? String(req.query.invoice_id)
    : undefined;
  await OrderService.cancelGatewayPayment(invoiceId);
  res.redirect(`${config.frontend_url}/dashboard/orders?payment=cancelled`);
});

const allPayments = catchAsync(async (_req, res) => {
  const result = await OrderService.allPayments();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payments retrieved",
    data: result,
  });
});

const myPayments = catchAsync(async (req, res) => {
  const result = await OrderService.myPayments(req.user!.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Payments retrieved",
    data: result,
  });
});

export const OrderController = {
  checkout,
  myOrders,
  getMyOrder,
  callback,
  webhook,
  cancel,
  allPayments,
  myPayments,
};
