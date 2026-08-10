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
	ILoginUserPayload,
	IRegisterAttendeePayload,
	IRequestUser,
} from "./auth.interface";

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
	const { name, password, phone, location } = payload;

	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
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

			// Email/password registration must still complete OTP verification.
			isEmailVerified: false,

			attendee: {
				create: {
					phone,
					location,
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

	return {
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
		(user.role === UserRole.ATTENDEE ||
			user.role === UserRole.ORGANIZER) &&
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
		user.password,
	);

	if (!isPasswordMatched) {
		throw new Error("Invalid credentials");
	}

	/**
	 * Organizer cannot log in until Admin/Super Admin approves them.
	 */
	if (
		user.role === UserRole.ORGANIZER &&
		user.organizer?.approvalStatus !==
			OrganizerApprovalStatus.APPROVED
	) {
		throw new Error("Organizer account has not been approved");
	}

	/**
	 * Event Staff should not use the system until their
	 * invitation has been accepted.
	 */
	if (
		user.role === UserRole.EVENT_STAFF &&
		user.eventStaff?.invitationStatus !==
			StaffInvitationStatus.ACCEPTED
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

	if (
		!verifiedRefreshToken.success ||
		!verifiedRefreshToken.data
	) {
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
		user.organizer?.approvalStatus !==
			OrganizerApprovalStatus.APPROVED
	) {
		throw new Error("Organizer account is not approved");
	}

	/**
	 * Don't issue fresh tokens to revoked/unaccepted Event Staff.
	 */
	if (
		user.role === UserRole.EVENT_STAFF &&
		user.eventStaff?.invitationStatus !==
			StaffInvitationStatus.ACCEPTED
	) {
		throw new Error("Event staff account is inactive");
	}

	const { accessToken, refreshToken } = generateTokens(user);

	return {
		accessToken,
		refreshToken,
	};
};

export const AuthService = {
	registerAttendee,
	loginUser,
	getMe,
	refreshToken,
};