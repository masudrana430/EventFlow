import type { UserRole } from "../../../generated/prisma/enums";

export interface IRegisterAttendeePayload {
	name: string;
	email: string;
	password: string;
	phone?: string;
	location?: string;
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
}