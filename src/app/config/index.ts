import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const config = {
  node_env: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  database_url: process.env.DATABASE_URL,
  direct_url: process.env.DIRECT_URL,
  backend_url: process.env.BACKEND_URL ?? "http://localhost:5000",
  frontend_url: process.env.FRONTEND_URL ?? "http://localhost:3000",

  bcrypt_salt_rounds: Number(process.env.BCRYPT_SALT_ROUNDS ?? 10),
  jwt_access_secret: process.env.JWT_ACCESS_SECRET ?? "",
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET ?? "",
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
  qr_secret: process.env.QR_SECRET ?? "",

  google_client_id: process.env.GOOGLE_CLIENT_ID ?? "",

  super_admin_name: process.env.SUPER_ADMIN_NAME ?? "",
  super_admin_email: process.env.SUPER_ADMIN_EMAIL ?? "",
  super_admin_password: process.env.SUPER_ADMIN_PASSWORD ?? "",
  tester_admin_name: process.env.TESTER_ADMIN_NAME ?? "",
  tester_admin_email: process.env.TESTER_ADMIN_EMAIL ?? "",
  tester_admin_password: process.env.TESTER_ADMIN_PASSWORD ?? "",

  redis_url: process.env.REDIS_URL,
  redis_user: process.env.REDIS_USER ?? "default",
  redis_password: process.env.REDIS_PASSWORD ?? "",
  redis_host: process.env.REDIS_HOST ?? "",
  redis_port: Number(process.env.REDIS_PORT ?? 6379),

  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME ?? "",
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY ?? "",
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET ?? "",

  email_sender: process.env.EMAIL_SENDER ?? "",
  resend_api_key:
    process.env.RESEND_API_KEY ?? process.env.SMTP_PASSWORD ?? "",
  smtp_host: process.env.SMTP_HOST ?? "",
  smtp_port: Number(process.env.SMTP_PORT ?? 465),
  smtp_user: process.env.SMTP_USER ?? "",
  smtp_password: process.env.SMTP_PASSWORD ?? "",

  uddoktapay_base_url:
    process.env.UDDOKTAPAY_BASE_URL ?? "https://sandbox.uddoktapay.com",
  uddoktapay_api_key: process.env.UDDOKTAPAY_API_KEY ?? "",

  reservation_minutes: Number(process.env.RESERVATION_MINUTES ?? 10),
  service_fee_percent: Number(process.env.SERVICE_FEE_PERCENT ?? 5),
  platform_commission_percent: Number(
    process.env.PLATFORM_COMMISSION_PERCENT ?? 10,
  ),
  payout_hold_days: Number(process.env.PAYOUT_HOLD_DAYS ?? 7),
};

export default config;
