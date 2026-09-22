import ejs from "ejs";
import path from "node:path";

type VerificationEmailOptions = {
  name: string;
  otp: string;
  heading?: string;
  message?: string;
  preheader?: string;
  expirationMinutes?: number;
};

const verificationTemplatePath = path.join(
  process.cwd(),
  "src/app/templates/registration-user-otp.ejs",
);

export const renderVerificationEmail = async ({
  name,
  otp,
  heading = "Verify your email address",
  message = "Use the secure verification code below to continue with your EventFlow account.",
  preheader = "Your EventFlow verification code is ready.",
  expirationMinutes = 10,
}: VerificationEmailOptions) =>
  ejs.renderFile(verificationTemplatePath, {
    name,
    otp,
    heading,
    message,
    preheader,
    expirationMinutes,
    year: new Date().getFullYear(),
  });
