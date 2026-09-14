/** biome-ignore-all lint/correctness/noUnusedImports: <explanation> */
/** biome-ignore-all assist/source/organizeImports: <explanation> */
import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type Application,
  type Request,
  type Response,
} from "express";
import httpStatus from "http-status";
import swaggerUi from "swagger-ui-express";
import config from "./app/config";
import { openApiSpec } from "./app/docs/openapi";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";

import type { NextFunction } from "express";
import { z } from "zod";
import { UserRoutes } from "./app/module/user/user.route";

const app: Application = express();

app.use(
  cors({
    origin: config.frontend_url,
    credentials: true,
  }),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

// API documentation
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

app.post("/test", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(httpStatus.OK).json({
      success: true,
      message: "EventFlow Zod validation successful",
      data: null,
    });
  } catch (error) {
    console.error("Error in /zod route:", error);

    next(error);
  }
});

// Basic route
app.get("/", async (_req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    success: true,
    message: "Welcome to EventFlow Backend",
  });
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
