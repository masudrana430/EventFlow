import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { z } from "zod";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";

export const validateRequest = (schema: z.ZodType) =>
  catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const result = await schema.safeParseAsync(req.body ?? {});

    if (!result.success) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        result.error.issues[0]?.message ?? "Validation failed",
      );
    }

    req.body = result.data;
    next();
  });
