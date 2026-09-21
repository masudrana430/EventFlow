import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import httpStatus from "http-status";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import {
  AuthProvider,
  OrganizerApprovalStatus,
  StaffInvitationStatus,
  UserRole,
  UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { googleClient } from "../../lib/googleAuth";
import { prisma } from "../../lib/prisma";
import { redisClient } from "../../lib/redis";
import { AppError } from "../../utils/AppError";
import { sendEmail, safeSendEmail } from "../../utils/email";
import { jwtUtils } from "../../utils/jwt";
import { sha256 } from "../../utils/security";
import type {
  IChangePasswordPayload,
  IForgotPasswordPayload,
  IGoogleLoginPayload,
  ILoginUserPayload,
  IRegisterAttendeePayload,
  IRequestUser,
  IResetPasswordPayload,
  ISessionMeta,
  ISetPasswordPayload,
  IVerifyEmailPayload,
} from "./auth.interface";

const OTP_TTL_SECONDS = 10 * 60;
const OTP_COOLDOWN_SECONDS = 60;
const MAX_OTP_ATTEMPTS = 5;

const normalizedEmail = (email: string) => email.trim().toLowerCase();

const createTokens = async (
  user: { id: string; name: string; email: string; role: UserRole },
  meta: ISessionMeta = {},
  existingSessionId?: string,
) => {
  const sessionId = existingSessionId ?? crypto.randomUUID();
  const payload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sid: sessionId,
  };

  const accessToken = jwtUtils.createToken(
    payload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions["expiresIn"],
  );

  const refreshToken = jwtUtils.createToken(
    payload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions["expiresIn"],
  );

  const decoded = jwt.decode(refreshToken) as JwtPayload | null;
  const expiresAt = decoded?.exp
    ? new Date(decoded.exp * 1000)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const data = {
    userId: user.id,
    refreshTokenHash: sha256(refreshToken),
    expiresAt,
    revokedAt: null,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  };

  if (existingSessionId) {
    await prisma.session.update({
      where: { id: existingSessionId },
      data,
    });
  } else {
    await prisma.session.create({
      data: {
        id: sessionId,
        ...data,
      },
    });
  }

  return { accessToken, refreshToken };
};

const issueOtp = async (
  prefix: string,
  email: string,
  subject: string,
  html: (otp: string) => string,
) => {
  if (!redisClient.isOpen) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "OTP service is temporarily unavailable",
    );
  }

  const cooldownKey = `${prefix}:cooldown:${email}`;
  if (await redisClient.exists(cooldownKey)) {
    throw new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      "Please wait 60 seconds before requesting another OTP",
    );
  }

  const otp = crypto.randomInt(100000, 1000000).toString();
  await redisClient.set(`${prefix}:otp:${email}`, otp, {
    expiration: { type: "EX", value: OTP_TTL_SECONDS },
  });
  await redisClient.set(cooldownKey, "1", {
    expiration: { type: "EX", value: OTP_COOLDOWN_SECONDS },
  });
  await redisClient.del(`${prefix}:attempts:${email}`);

  try {
    await sendEmail({
      to: email,
      subject,
      html: html(otp),
    });
  } catch (error) {
    await redisClient
      .del([`${prefix}:otp:${email}`, cooldownKey])
      .catch(() => undefined);

    console.error("OTP email delivery failed:", error);

    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Verification email could not be sent. Please try again",
    );
  }
};

const verifyOtp = async (prefix: string, email: string, otp: string) => {
  const attemptsKey = `${prefix}:attempts:${email}`;
  const attempts = await redisClient.incr(attemptsKey);
  if (attempts === 1) {
    await redisClient.expire(attemptsKey, OTP_TTL_SECONDS);
  }

  if (attempts > MAX_OTP_ATTEMPTS) {
    throw new AppError(
      httpStatus.TOO_MANY_REQUESTS,
      "Too many invalid OTP attempts",
    );
  }

  const stored = await redisClient.get(`${prefix}:otp:${email}`);
  if (!stored) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP has expired");
  }

  if (stored !== otp) {
    throw new AppError(httpStatus.BAD_REQUEST, "OTP does not match");
  }

  await redisClient.del([
    `${prefix}:otp:${email}`,
    attemptsKey,
  ]);
};

const registerAttendee = async (payload: IRegisterAttendeePayload) => {
  const email = normalizedEmail(payload.email);

  if (await prisma.user.findUnique({ where: { email } })) {
    throw new AppError(httpStatus.CONFLICT, "User with this email already exists");
  }

  if (!redisClient.isOpen) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Registration service is temporarily unavailable",
    );
  }

  const password = await bcrypt.hash(
    payload.password,
    config.bcrypt_salt_rounds,
  );

  await redisClient.set(
    `attendee-registration:data:${email}`,
    JSON.stringify({
      name: payload.name,
      email,
      password,
      attendee: payload.attendee ?? {},
    }),
    { expiration: { type: "EX", value: OTP_TTL_SECONDS } },
  );

  await issueOtp(
    "attendee-registration",
    email,
    "Verify your EventFlow account",
    (otp) => `
      <h2>Verify your EventFlow account</h2>
      <p>Your verification code is <strong>${otp}</strong>.</p>
      <p>This code expires in 10 minutes.</p>
    `,
  );
};

const resendAttendeeOtp = async (emailInput: string) => {
  const email = normalizedEmail(emailInput);
  const data = await redisClient.get(`attendee-registration:data:${email}`);

  if (!data) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Registration data expired. Please register again",
    );
  }

  await issueOtp(
    "attendee-registration",
    email,
    "Your new EventFlow verification code",
    (otp) => `<p>Your new EventFlow verification code is <strong>${otp}</strong>.</p>`,
  );
};

const verifyAttendeeEmail = async (
  payload: IVerifyEmailPayload,
  meta: ISessionMeta,
) => {
  const email = normalizedEmail(payload.email);

  if (await prisma.user.findUnique({ where: { email } })) {
    throw new AppError(httpStatus.CONFLICT, "This email is already registered");
  }

  await verifyOtp("attendee-registration", email, payload.otp);

  const data = await redisClient.get(`attendee-registration:data:${email}`);
  if (!data) {
    throw new AppError(httpStatus.BAD_REQUEST, "Registration data has expired");
  }

  const registration = JSON.parse(data) as {
    name: string;
    email: string;
    password: string;
    attendee?: { phone?: string; location?: string };
  };

  const created = await prisma.user.create({
    data: {
      name: registration.name,
      email,
      password: registration.password,
      role: UserRole.ATTENDEE,
      status: UserStatus.ACTIVE,
      authProvider: AuthProvider.CREDENTIALS,
      isEmailVerified: true,
      attendee: {
        create: {
          phone: registration.attendee?.phone,
          location: registration.attendee?.location,
        },
      },
    },
    include: { attendee: true },
    omit: { password: true },
  });

  await redisClient.del(`attendee-registration:data:${email}`);

  const { attendee, ...user } = created;
  const tokens = await createTokens(user, meta);

  void safeSendEmail({
    to: email,
    subject: "Welcome to EventFlow",
    html: `<h2>Welcome, ${user.name}!</h2><p>Your EventFlow account is verified and ready.</p>`,
  });

  return { ...tokens, user, attendee };
};

const loginUser = async (
  payload: ILoginUserPayload,
  meta: ISessionMeta,
) => {
  const email = normalizedEmail(payload.email);
  const user = await prisma.user.findUnique({
    where: { email },
    include: { organizer: true, eventStaff: true },
  });

  if (!user || !user.password) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
  }

  if (user.status === UserStatus.BLOCKED) {
    throw new AppError(httpStatus.FORBIDDEN, "Your account is blocked");
  }

  if (!user.isEmailVerified) {
    throw new AppError(httpStatus.FORBIDDEN, "Please verify your email first");
  }

  if (!(await bcrypt.compare(payload.password, user.password))) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
  }

  if (
    user.role === UserRole.ORGANIZER &&
    user.organizer?.approvalStatus !== OrganizerApprovalStatus.APPROVED
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Organizer application is not approved",
    );
  }

  if (
    user.role === UserRole.EVENT_STAFF &&
    user.eventStaff?.invitationStatus !== StaffInvitationStatus.ACCEPTED
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Event staff invitation is not active",
    );
  }

  const tokens = await createTokens(user, meta);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    ...tokens,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  };
};

const getMe = async (requestUser: IRequestUser) => {
  const user = await prisma.user.findUnique({
    where: { id: requestUser.userId },
    include: {
      attendee: true,
      organizer: true,
      eventStaff: true,
    },
    omit: { password: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return user;
};

const refreshToken = async (token: string, meta: ISessionMeta) => {
  const verified = jwtUtils.verifyToken(token, config.jwt_refresh_secret);
  if (!verified.success || !verified.data) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid refresh token");
  }

  const data = verified.data as JwtPayload & { userId: string; sid?: string };
  if (!data.sid) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Refresh session is invalid");
  }

  const session = await prisma.session.findUnique({
    where: { id: data.sid },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.refreshTokenHash !== sha256(token)
  ) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Refresh session is revoked or expired");
  }

  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    include: { organizer: true, eventStaff: true },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new AppError(httpStatus.UNAUTHORIZED, "User is inactive");
  }

  if (
    user.role === UserRole.ORGANIZER &&
    user.organizer?.approvalStatus !== OrganizerApprovalStatus.APPROVED
  ) {
    throw new AppError(httpStatus.FORBIDDEN, "Organizer is not approved");
  }

  return createTokens(user, meta, session.id);
};

const googleLogin = async (
  payload: IGoogleLoginPayload,
  meta: ISessionMeta,
) => {
  let googlePayload;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: payload.idToken,
      audience: config.google_client_id,
    });
    googlePayload = ticket.getPayload();
  } catch {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid Google ID token");
  }

  if (
    !googlePayload?.email ||
    !googlePayload.sub ||
    !googlePayload.name ||
    !googlePayload.email_verified
  ) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Google account is not verified");
  }

  const email = normalizedEmail(googlePayload.email);
  let user = await prisma.user.findUnique({
    where: { email },
    include: { attendee: true },
  });

  if (user && user.role !== UserRole.ATTENDEE) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Google login is available only to attendees",
    );
  }

  if (user?.status === UserStatus.BLOCKED) {
    throw new AppError(httpStatus.FORBIDDEN, "Your account is blocked");
  }

  if (user?.googleId && user.googleId !== googlePayload.sub) {
    throw new AppError(
      httpStatus.CONFLICT,
      "This email is linked to another Google account",
    );
  }

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: googlePayload.sub,
        isEmailVerified: true,
        authProvider: user.password ? AuthProvider.BOTH : AuthProvider.GOOGLE,
      },
      include: { attendee: true },
    });
  } else {
    user = await prisma.user.create({
      data: {
        name: googlePayload.name,
        email,
        role: UserRole.ATTENDEE,
        status: UserStatus.ACTIVE,
        googleId: googlePayload.sub,
        authProvider: AuthProvider.GOOGLE,
        isEmailVerified: true,
        attendee: {
          create: {
            profileImage: googlePayload.picture,
          },
        },
      },
      include: { attendee: true },
    });

    void safeSendEmail({
      to: email,
      subject: "Welcome to EventFlow",
      html: `<h2>Welcome, ${user.name}!</h2><p>Your attendee account was created with Google.</p>`,
    });
  }

  const tokens = await createTokens(user, meta);
  return {
    ...tokens,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

const forgotPassword = async (payload: IForgotPasswordPayload) => {
  const email = normalizedEmail(payload.email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.password) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Password reset is not available for this account",
    );
  }

  if (user.status === UserStatus.BLOCKED) {
    throw new AppError(httpStatus.FORBIDDEN, "Your account is blocked");
  }

  await issueOtp(
    "forgot-password",
    email,
    "EventFlow password reset code",
    (otp) => `<p>Your password reset code is <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
  );
};

const resetPassword = async (payload: IResetPasswordPayload) => {
  const email = normalizedEmail(payload.email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.password) {
    throw new AppError(httpStatus.BAD_REQUEST, "Password reset is not available");
  }

  await verifyOtp("forgot-password", email, payload.otp);

  const password = await bcrypt.hash(
    payload.newPassword,
    config.bcrypt_salt_rounds,
  );

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        password,
        mustChangePassword: false,
        authProvider:
          user.authProvider === AuthProvider.GOOGLE
            ? AuthProvider.BOTH
            : user.authProvider,
      },
    }),
    prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  void safeSendEmail({
    to: email,
    subject: "Your EventFlow password was changed",
    html: "<p>Your EventFlow password was reset successfully. All existing sessions were signed out.</p>",
  });
};

const changePassword = async (
  requestUser: IRequestUser,
  payload: IChangePasswordPayload,
) => {
  const user = await prisma.user.findUnique({
    where: { id: requestUser.userId },
  });

  if (!user?.password) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This account does not have a password yet",
    );
  }

  if (!(await bcrypt.compare(payload.currentPassword, user.password))) {
    throw new AppError(httpStatus.BAD_REQUEST, "Current password is incorrect");
  }

  const password = await bcrypt.hash(
    payload.newPassword,
    config.bcrypt_salt_rounds,
  );

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        password,
        mustChangePassword: false,
      },
    }),
    prisma.session.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        ...(requestUser.sessionId
          ? { id: { not: requestUser.sessionId } }
          : {}),
      },
      data: { revokedAt: new Date() },
    }),
  ]);
};

const setPassword = async (
  requestUser: IRequestUser,
  payload: ISetPasswordPayload,
) => {
  const user = await prisma.user.findUnique({
    where: { id: requestUser.userId },
  });

  if (!user || user.role !== UserRole.ATTENDEE || !user.googleId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Set password is available only to Google attendees",
    );
  }

  if (user.password) {
    throw new AppError(httpStatus.CONFLICT, "This account already has a password");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await bcrypt.hash(
        payload.newPassword,
        config.bcrypt_salt_rounds,
      ),
      authProvider: AuthProvider.BOTH,
    },
  });
};

const logout = async (requestUser: IRequestUser) => {
  if (!requestUser.sessionId) return;

  await prisma.session.updateMany({
    where: {
      id: requestUser.sessionId,
      userId: requestUser.userId,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
};

const logoutAll = async (requestUser: IRequestUser) => {
  await prisma.session.updateMany({
    where: { userId: requestUser.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};

export const AuthService = {
  registerAttendee,
  resendAttendeeOtp,
  verifyAttendeeEmail,
  loginUser,
  getMe,
  refreshToken,
  googleLogin,
  forgotPassword,
  resetPassword,
  changePassword,
  setPassword,
  logout,
  logoutAll,
};
