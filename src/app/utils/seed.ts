import bcrypt from "bcryptjs";
import {
	UserRole,
	UserStatus,
} from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";

export const seedSuperAdmin = async () => {
	const name = config.super_admin_name;
	const email = config.super_admin_email;
	const password = config.super_admin_password;

	if (!name || !email || !password) {
		throw new Error(
			"Super Admin name, email, or password is missing in .env",
		);
	}

	const normalizedEmail = email.trim().toLowerCase();

	const isSuperAdminExist = await prisma.user.findFirst({
		where: {
			role: UserRole.SUPER_ADMIN,
		},
	});

	if (isSuperAdminExist) {
		console.log("Super Admin already exists!");
		return;
	}

	const hashedPassword = await bcrypt.hash(
		password,
		Number(config.bcrypt_salt_rounds),
	);

	const superAdmin = await prisma.user.create({
		data: {
			name,
			email: normalizedEmail,
			password: hashedPassword,

			role: UserRole.SUPER_ADMIN,
			status: UserStatus.ACTIVE,

			isEmailVerified: true,
			mustChangePassword: false,
		},
		omit: {
			password: true,
		},
	});

	console.log("Super Admin created:", superAdmin);
};


export const seedTesterAdmin = async () => {
	const name = config.tester_admin_name;
	const email = config.tester_admin_email;
	const password = config.tester_admin_password;

	if (!name || !email || !password) {
		throw new Error(
			"Tester Admin name, email, or password is missing in .env",
		);
	}

	const normalizedEmail = email.trim().toLowerCase();

	const isTesterAdminExist =
		await prisma.user.findUnique({
			where: {
				email: normalizedEmail,
			},
		});

	if (isTesterAdminExist) {
		console.log("Tester Admin already exists!");
		return;
	}

	const hashedPassword = await bcrypt.hash(
		password,
		Number(config.bcrypt_salt_rounds),
	);

	const testerAdmin = await prisma.user.create({
		data: {
			name,
			email: normalizedEmail,
			password: hashedPassword,

			role: UserRole.ADMIN,
			status: UserStatus.ACTIVE,

			isEmailVerified: true,
			mustChangePassword: false,
		},
		omit: {
			password: true,
		},
	});

	console.log("Tester Admin created:", testerAdmin);
};