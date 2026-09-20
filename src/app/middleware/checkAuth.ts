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
      };
    }
  }
}

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

    const { email, name, userId, role } = verified.data as JwtPayload & {
      email: string;
      name: string;
      userId: string;
      role: UserRole;
    };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });

    if (!user || user.email !== email) {
      throw new AppError(httpStatus.UNAUTHORIZED, "User no longer exists");
    }

    if (user.status === "BLOCKED") {
      throw new AppError(httpStatus.FORBIDDEN, "Your account is blocked");
    }

    if (requiredRoles.length && !requiredRoles.includes(user.role)) {
      throw new AppError(httpStatus.FORBIDDEN, "You do not have permission for this action");
    }

    req.user = {
      email: user.email,
      name: user.name,
      userId: user.id,
      role: user.role,
    };

    next();
  });
