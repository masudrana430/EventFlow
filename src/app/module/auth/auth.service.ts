import bcrypt from "bcryptjs";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import {
  OrganizerApprovalStatus,
  StaffInvitationStatus,
  UserRole,
  UserStatus,
} from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";
import type {
  IForgotPasswordPayload,
  ILoginUserPayload,
  IRegisterAttendeePayload,
  IRequestUser,
  IResetPasswordPayload,
} from "./auth.interface";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import { googleClient } from "../../lib/googleAuth";

import { redisClient } from "../../lib/redis";
import crypto from "crypto";

/**
 * Creates EventFlow access + refresh tokens.
 *
 * Keeping this in one function prevents us from duplicating
 * token-generation logic inside login and refresh-token.
 */
const generateTokens = (user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}) => {
  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    config.jwt_access_expires_in as SignOptions,
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    config.jwt_refresh_expires_in as SignOptions,
  );

  return {
    accessToken,
    refreshToken,
  };
};

/**
 * Register a normal EventFlow attendee.
 */
const registerAttendee = async (payload: IRegisterAttendeePayload) => {
  const { name, password, attendee: attendeeData } = payload;

  const email = payload.email.trim().toLowerCase();

  const isUserExists = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (isUserExists) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 8);

  const createdUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,

      role: UserRole.ATTENDEE,
      status: UserStatus.ACTIVE,

      isEmailVerified: false,

      attendee: {
        create: {
          phone: attendeeData?.phone || "",
          location: attendeeData?.location || "",
        },
      },
    },

    omit: {
      password: true,
    },

    include: {
      attendee: true,
    },
  });

  const { attendee, ...user } = createdUser;

  const { accessToken, refreshToken } = generateTokens(user);

  return {
    accessToken,
    refreshToken,
    user,
    attendee,
  };
};

/**
 * Login with email + password.
 */
const loginUser = async (payload: ILoginUserPayload) => {
  const { password } = payload;

  const email = payload.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },

    include: {
      organizer: true,
      eventStaff: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.status === UserStatus.BLOCKED) {
    throw new Error("User is blocked");
  }

  /**
   * Attendee and Organizer are self-registration flows.
   * They must verify their email before normal login.
   */
  if (
    (user.role === UserRole.ATTENDEE || user.role === UserRole.ORGANIZER) &&
    !user.isEmailVerified
  ) {
    throw new Error("Please verify your email before logging in");
  }

  /**
   * A Google-only attendee may not have a password.
   */
  if (!user.password) {
    throw new Error(
      "Password login is not available for this account. Please use Google login or set a password.",
    );
  }

  const isPasswordMatched = await bcrypt.compare(
    password,
    user.password as string,
  );

  if (!isPasswordMatched) {
    throw new Error("Invalid credentials");
  }

  /**
   * Organizer cannot log in until Admin/Super Admin approves them.
   */
  if (
    user.role === UserRole.ORGANIZER &&
    user.organizer?.approvalStatus !== OrganizerApprovalStatus.APPROVED
  ) {
    throw new Error("Organizer account has not been approved");
  }

  /**
   * Event Staff should not use the system until their
   * invitation has been accepted.
   */
  if (
    user.role === UserRole.EVENT_STAFF &&
    user.eventStaff?.invitationStatus !== StaffInvitationStatus.ACCEPTED
  ) {
    throw new Error("Event staff invitation has not been accepted");
  }

  const { accessToken, refreshToken } = generateTokens(user);

  return {
    accessToken,
    refreshToken,

    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  };
};

/**
 * Return currently authenticated user.
 */
const getMe = async (user: IRequestUser) => {
  const isUserExists = await prisma.user.findUnique({
    where: {
      id: user.userId,
    },

    include: {
      attendee: true,
      organizer: true,
      eventStaff: true,
    },

    omit: {
      password: true,
    },
  });

  if (!isUserExists) {
    throw new Error("User not found");
  }

  return isUserExists;
};

/**
 * Generate new access + refresh tokens
 * from a valid refresh token.
 */
const refreshToken = async (token: string) => {
  const verifiedRefreshToken = jwtUtils.verifyToken(
    token,
    config.jwt_refresh_secret,
  );

  if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
    throw new Error(
      config.node_env === "development"
        ? verifiedRefreshToken.error
        : "Invalid refresh token",
    );
  }

  const data = verifiedRefreshToken.data as JwtPayload;

  const user = await prisma.user.findUnique({
    where: {
      id: data.userId,
    },

    include: {
      organizer: true,
      eventStaff: true,
    },
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new Error("User is inactive or not found");
  }

  /**
   * Don't issue fresh tokens to an unapproved organizer.
   */
  if (
    user.role === UserRole.ORGANIZER &&
    user.organizer?.approvalStatus !== OrganizerApprovalStatus.APPROVED
  ) {
    throw new Error("Organizer account is not approved");
  }

  /**
   * Don't issue fresh tokens to revoked/unaccepted Event Staff.
   */
  if (
    user.role === UserRole.EVENT_STAFF &&
    user.eventStaff?.invitationStatus !== StaffInvitationStatus.ACCEPTED
  ) {
    throw new Error("Event staff account is inactive");
  }

  const { accessToken, refreshToken } = generateTokens(user);

  return {
    accessToken,
    refreshToken,
  };
};

const googleLogin = async (payload: IGoogleLoginPayload) => {
  let googleIdTokenPayload: TokenPayload | null | undefined = null;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: payload.idToken,
      audience: config.google_client_id,
    });

    googleIdTokenPayload = ticket.getPayload();
  } catch (error) {
    console.error("Error verifying Google ID token:", error);

    throw new Error("Invalid Google ID token");
  }

  if (
    !googleIdTokenPayload ||
    !googleIdTokenPayload.email ||
    !googleIdTokenPayload.sub ||
    !googleIdTokenPayload.name
  ) {
    throw new Error("Google ID token payload is missing required fields");
  }

  if (!googleIdTokenPayload.email_verified) {
    throw new Error("Google email is not verified");
  }

  const email = googleIdTokenPayload.email.trim().toLowerCase();

  const googleId = googleIdTokenPayload.sub;

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
    include: {
      attendee: true,
    },
  });

  let user = existingUser;

  if (user) {
    if (user.role !== UserRole.ATTENDEE) {
      throw new Error("Google login is only available for attendees");
    }

    if (user.status === UserStatus.BLOCKED) {
      throw new Error("User is blocked");
    }

    if (user.googleId && user.googleId !== googleId) {
      throw new Error(
        "This email is already linked with another Google account",
      );
    }

    // Link Google account if needed
    // and always mark Google-verified email as verified.
    user = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        googleId,
        isEmailVerified: true,
      },
      include: {
        attendee: true,
      },
    });
  } else {
    user = await prisma.user.create({
      data: {
        name: googleIdTokenPayload.name,
        email,
        role: UserRole.ATTENDEE,
        status: UserStatus.ACTIVE,

        googleId,
        isEmailVerified: true,

        attendee: {
          create: {
            profileImage: googleIdTokenPayload.picture,
          },
        },
      },
      include: {
        attendee: true,
      },
    });
  }

  const { accessToken, refreshToken } = generateTokens(user);

  return {
    accessToken,
    refreshToken,
  };
};

const forgotPassword = async (payload: IForgotPasswordPayload) => {
  const email = payload.email.trim().toLowerCase();

  const isUserExist = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!isUserExist) {
    throw new Error("User does not exist");
  }

  if (isUserExist.status === UserStatus.BLOCKED) {
    throw new Error("User is blocked");
  }

  if (!isUserExist.isEmailVerified) {
    throw new Error("User email is not verified");
  }

  // Pure Google account has no password to reset
  if (!isUserExist.password) {
    throw new Error(
      "This account uses Google login. Please continue with Google.",
    );
  }

  const otp = crypto.randomInt(100000, 1000000).toString();

  const key = `forgot-password-otp:${email}`;

  const expirationSeconds = 5 * 60;

  await redisClient.set(key, otp, {
    expiration: {
      type: "EX",
      value: expirationSeconds,
    },
  });

  console.log("Forgot password OTP:", otp);

  // Later: send this OTP to the user's email

  return {
    message: "OTP sent successfully",
  };
};

const resetPassword = async (payload: IResetPasswordPayload) => {
  const {email, otp, newPassword} = payload;

  const isUserExist = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (!isUserExist) {
    throw new Error("User does not exist");
  }

  if (isUserExist.status === UserStatus.BLOCKED) {
    throw new Error("User is blocked");
  }

  if (!isUserExist.isEmailVerified) {
    throw new Error("User email is not verified");
  }

  // Pure Google account has no password to reset
  if (!isUserExist.password) {
    throw new Error(
      "This account uses Google login. Please continue with Google.",
    );
  }

  const key = `forgot-password-otp:${email}`;
  const redisOtp = await redisClient.get(key)

	if(!redisOtp){
		throw new Error("Invalid OTP")
	}

	if(redisOtp !== otp){
		throw new Error("OTP Does Not Match")
	}

	const hashedNewPassword = await bcrypt.hash(newPassword, Number(config.bcrypt_salt_rounds));

	await prisma.user.update({
		where : {
			email : isUserExist.email
		},
		data : {
			password : hashedNewPassword
		}
	});

	await redisClient.del([key]);
};

export const AuthService = {
  registerAttendee,
  loginUser,
  getMe,
  refreshToken,
  googleLogin,
  forgotPassword,
  resetPassword,
};

export interface IGoogleLoginPayload {
  idToken: string;
}
