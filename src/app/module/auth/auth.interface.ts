import type { UserRole } from "../../../generated/prisma/enums";

export interface IRegisterAttendeePayload {
  name: string;
  email: string;
  password: string;
  attendee?: {
    phone?: string;
    location?: string;
  };
}

export interface IVerifyEmailPayload {
  email: string;
  otp: string;
}

export interface ILoginUserPayload {
  email: string;
  password: string;
}

export interface IRequestUser {
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  sessionId?: string;
}

export interface IForgotPasswordPayload {
  email: string;
}

export interface IResetPasswordPayload {
  email: string;
  newPassword: string;
  otp: string;
}

export interface IGoogleLoginPayload {
  idToken: string;
}

export interface IChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface ISetPasswordPayload {
  newPassword: string;
}

export interface ISessionMeta {
  ipAddress?: string;
  userAgent?: string;
}
