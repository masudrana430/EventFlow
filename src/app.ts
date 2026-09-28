import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application, type Request, type Response } from "express";
import httpStatus from "http-status";
import swaggerUi from "swagger-ui-express";
import config from "./app/config";
import { openApiSpec } from "./app/docs/openapi";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { csrfGuard } from "./app/middleware/csrfGuard";
import { notFound } from "./app/middleware/notFound";
import { AdminRoutes } from "./app/module/admin/admin.route";
import { AnalyticsRoutes } from "./app/module/analytics/analytics.route";
import { AnnouncementRoutes } from "./app/module/announcement/announcement.route";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { CategoryRoutes } from "./app/module/category/category.route";
import { DisputeRoutes } from "./app/module/dispute/dispute.route";
import { EventRoutes } from "./app/module/event/event.route";
import { NotificationRoutes } from "./app/module/notification/notification.route";
import { OrderRoutes } from "./app/module/order/order.route";
import { OrganizerRoutes } from "./app/module/organizer/organizer.route";
import { PaymentRoutes } from "./app/module/payment/payment.route";
import { PayoutRoutes } from "./app/module/payout/payout.route";
import { PromoRoutes } from "./app/module/promo/promo.route";
import { RefundRoutes } from "./app/module/refund/refund.route";
import { ReviewRoutes } from "./app/module/review/review.route";
import { StaffRoutes } from "./app/module/staff/staff.route";
import { TicketRoutes } from "./app/module/ticket/ticket.route";
import { TicketTypeRoutes } from "./app/module/ticketType/ticketType.route";
import { TransferRoutes } from "./app/module/transfer/transfer.route";
import { UserRoutes } from "./app/module/user/user.route";
import { WaitlistRoutes } from "./app/module/waitlist/waitlist.route";

const app: Application = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: config.frontend_url,
    credentials: true,
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(csrfGuard);

app.get("/api-docs.json", (_req: Request, res: Response) => {
  res.status(httpStatus.OK).json(openApiSpec);
});
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    explorer: true,
    customSiteTitle: "EventFlow API Docs",
  }),
);

app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/user", UserRoutes);
app.use("/api/v1/organizer", OrganizerRoutes);
app.use("/api/v1/admin", AdminRoutes);
app.use("/api/v1/categories", CategoryRoutes);
app.use("/api/v1/events", EventRoutes);
app.use("/api/v1/ticket-types", TicketTypeRoutes);
app.use("/api/v1/staff", StaffRoutes);
app.use("/api/v1/promos", PromoRoutes);
app.use("/api/v1/orders", OrderRoutes);
app.use("/api/v1/payment", PaymentRoutes);
app.use("/api/v1/tickets", TicketRoutes);
app.use("/api/v1/refunds", RefundRoutes);
app.use("/api/v1/transfers", TransferRoutes);
app.use("/api/v1/waitlist", WaitlistRoutes);
app.use("/api/v1/notifications", NotificationRoutes);
app.use("/api/v1/announcements", AnnouncementRoutes);
app.use("/api/v1/reviews", ReviewRoutes);
app.use("/api/v1/disputes", DisputeRoutes);
app.use("/api/v1/payouts", PayoutRoutes);
app.use("/api/v1/analytics", AnalyticsRoutes);

app.get("/", (_req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    success: true,
    message: "Welcome to EventFlow Backend",
    docs: "/api-docs",
  });
});

app.use(notFound);
app.use(globalErrorHandler);

export default app;
