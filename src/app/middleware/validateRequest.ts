import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { catchAsync } from "../utils/catchAsync";

export const validateRequest = (zodSchema: z.ZodType) => {
  return catchAsync(
    async (req: Request, _res: Response, next: NextFunction) => {
      const payload = req.body ?? {};

      const result = await zodSchema.safeParseAsync(payload);

      if (!result.success) {
        console.log(result.error);
        console.log(result.error.issues);

        throw new Error(result.error.issues[0]?.message ?? "Validation failed");
      }

      // validated + transformed/sanitized data
      req.body = result.data;

      next();
    },
  );
};
