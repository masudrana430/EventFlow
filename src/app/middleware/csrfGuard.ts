import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import config from "../config";
import { AppError } from "../utils/AppError";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const normalizeOrigin = (value: string) => value.replace(/\/$/, "");

const TRUSTED_ORIGINS = new Set(
  [config.frontend_url, config.backend_url]
    .filter(Boolean)
    .map(normalizeOrigin),
);

export const csrfGuard = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (
    config.node_env !== "production" ||
    SAFE_METHODS.has(req.method) ||
    req.headers.authorization
  ) {
    return next();
  }

  const hasAuthCookie = Boolean(
    req.cookies?.accessToken || req.cookies?.refreshToken,
  );

  if (!hasAuthCookie) return next();

  const origin = req.get("origin");

  if (!origin || !TRUSTED_ORIGINS.has(normalizeOrigin(origin))) {
    return next(
      new AppError(
        httpStatus.FORBIDDEN,
        "Cross-site request was rejected",
      ),
    );
  }

  next();
};
