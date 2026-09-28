import crypto from "node:crypto";
import config from "../config";

export const randomToken = (bytes = 32) =>
  crypto.randomBytes(bytes).toString("hex");

export const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

export const signTicketPayload = (ticketId: string, eventId: string) => {
  if (!config.qr_secret) {
    throw new Error("QR_SECRET is not configured");
  }

  const body = `${ticketId}.${eventId}`;
  const signature = crypto
    .createHmac("sha256", config.qr_secret)
    .update(body)
    .digest("hex");

  return `${body}.${signature}`;
};

export const verifyTicketPayload = (payload: string) => {
  if (!config.qr_secret) return null;

  const [ticketId, eventId, signature] = payload.split(".");
  if (!ticketId || !eventId || !signature) return null;

  const expected = crypto
    .createHmac("sha256", config.qr_secret)
    .update(`${ticketId}.${eventId}`)
    .digest("hex");

  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return null;
  }

  return { ticketId, eventId };
};

export const orderNumber = () =>
  `EVF-${Date.now()}-${crypto.randomInt(1000, 9999)}`;

export const ticketNumber = () =>
  `TKT-${Date.now()}-${crypto.randomInt(100000, 999999)}`;
