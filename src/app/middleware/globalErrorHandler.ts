import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { Prisma } from "../../generated/prisma/client";
import config from "../config";
import { AppError } from "../utils/AppError";

export const globalErrorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.error("EventFlow error:", err);

  let statusCode = httpStatus.INTERNAL_SERVER_ERROR;
  let message = "Internal Server Error";
  let name = "Internal Server Error";

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    name = err.name;
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Invalid database query payload";
    name = err.name;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    name = err.name;

    if (err.code === "P2002") {
      statusCode = httpStatus.CONFLICT;
      message = "A record with the same unique value already exists";
    } else if (err.code === "P2003") {
      statusCode = httpStatus.BAD_REQUEST;
      message = "A related resource does not exist";
    } else if (err.code === "P2025") {
      statusCode = httpStatus.NOT_FOUND;
      message = "Required record was not found";
    }
  } else if (err instanceof Error) {
    name = err.name;

    if (config.node_env === "development") {
      message = err.message;
    }
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    name,
    message,
    ...(config.node_env === "development" && err instanceof Error
      ? { stack: err.stack }
      : {}),
  });
};
