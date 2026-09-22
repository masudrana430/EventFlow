import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { JwtPayload } from "jsonwebtoken";
import type { UserRole } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: {
        email: string;
        name: string;
        userId: string;
        role: UserRole;
        sessionId?: string;
      };
    }
  }
}

const mustChangeAllowedPaths = new Set([
  "/api/v1/auth/me",
  "/api/v1/auth/change-password",
  "/api/v1/auth/logout",
  "/api/v1/auth/logout-all",
]);

export const auth = (...requiredRoles: UserRole[]) =>
  catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.accessToken
      ? req.cookies.accessToken
      : req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : req.headers.authorization;

    if (!token) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Authentication required");
    }

    const verified = jwtUtils.verifyToken(token, config.jwt_access_secret);

    if (!verified.success || !verified.data) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Invalid or expired access token");
    }

    const tokenData = verified.data as JwtPayload & {
      email: string;
      name: string;
      userId: string;
      role: UserRole;
      sid?: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        mustChangePassword: true,
      },
    });

    if (!user || user.email !== tokenData.email) {
      throw new AppError(httpStatus.UNAUTHORIZED, "User no longer exists");
    }

    if (user.status === "BLOCKED") {
      throw new AppError(httpStatus.FORBIDDEN, "Your account is blocked");
    }

    if (requiredRoles.length && !requiredRoles.includes(user.role)) {
      throw new AppError(httpStatus.FORBIDDEN, "You do not have permission for this action");
    }

    if (
      user.mustChangePassword &&
      !mustChangeAllowedPaths.has(req.originalUrl.split("?")[0])
    ) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "You must change your temporary password before using this feature",
      );
    }

    req.user = {
      email: user.email,
      name: user.name,
      userId: user.id,
      role: user.role,
      sessionId: tokenData.sid,
    };

    next();
  });
