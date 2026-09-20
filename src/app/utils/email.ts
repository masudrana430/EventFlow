import config from "../config";
import { transporter } from "../lib/nodeMailer";

export const sendEmail = async (payload: {
  to: string;
  subject: string;
  html: string;
}) =>
  transporter.sendMail({
    from: `"EventFlow" <${config.email_sender}>`,
    to: payload.to,
    replyTo: `"EventFlow Support" <${config.email_sender}>`,
    subject: payload.subject,
    html: payload.html,
  });

export const safeSendEmail = async (payload: {
  to: string;
  subject: string;
  html: string;
}) => {
  try {
    await sendEmail(payload);
  } catch (error) {
    console.error("Email delivery failed:", error);
  }
};
