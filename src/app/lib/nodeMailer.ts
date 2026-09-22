import nodemailer from "nodemailer";
import config from "../config";

export const transporter = nodemailer.createTransport({
  host: config.smtp_host,
  port: Number(config.smtp_port),
  secure: Number(config.smtp_port) === 465,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
  auth: {
    user: config.smtp_user,
    pass: config.smtp_password,
  },
});
