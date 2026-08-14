import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application, type Request, type Response } from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";

import type { NextFunction } from "express";
import { z } from "zod";

const app: Application = express();

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);

app.post(
	"/zod",
	async (
		req: Request,
		res: Response,
		next: NextFunction,
	) => {
		try {
			const AttendeeZodSchema = z.object({
				name: z
					.string()
					.trim()
					.min(2, "Name must be at least 2 characters"),

				email: z
					.string()
					.trim()
					.toLowerCase()
					.email("Invalid email address"),

				password: z
					.string()
					.min(8, "Password must be at least 8 characters"),

				phone: z
					.string()
					.trim()
					.optional(),

				location: z
					.string()
					.trim()
					.optional(),
			});

			const payload = req.body;

			const result =
				AttendeeZodSchema.safeParse(payload);

			if (!result.success) {
				console.error(
					"Validation failed:",
					result.error,
				);

				return res.status(httpStatus.BAD_REQUEST).json({
					success: false,
					message: "Validation failed",
					error: result.error,
				});
			}

			console.log(
				"Validation succeeded:",
				result.data,
			);

			res.status(httpStatus.OK).json({
				success: true,
				message:
					"EventFlow Zod validation successful",
				data: result.data,
			});
		} catch (error) {
			console.error(
				"Error in /zod route:",
				error,
			);

			next(error);
		}
	},
);

// Basic route
app.get("/", async (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to PH Healthcare System Backend",
	});
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
