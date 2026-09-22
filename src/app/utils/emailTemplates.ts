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

type EmailTone = "info" | "success" | "warning" | "danger" | "security";

type EmailDetail = {
  label: string;
  value: string;
  code?: boolean;
};

type TransactionalEmailOptions = {
  name: string;
  heading: string;
  message: string;
  preheader?: string;
  badge?: string;
  tone?: EmailTone;
  details?: EmailDetail[];
  highlightTitle?: string;
  highlightText?: string;
  actionLabel?: string;
  actionUrl?: string;
  note?: string;
};

const verificationTemplatePath = path.join(
  process.cwd(),
  "src/app/templates/registration-user-otp.ejs",
);

const transactionalTemplatePath = path.join(
  process.cwd(),
  "src/app/templates/transactional-email.ejs",
);

const toneColors: Record<
  EmailTone,
  {
    accent: string;
    accentLight: string;
    background: string;
    border: string;
    text: string;
  }
> = {
  info: {
    accent: "#4f46e5",
    accentLight: "#c4b5fd",
    background: "#f5f3ff",
    border: "#ddd6fe",
    text: "#312e81",
  },
  success: {
    accent: "#059669",
    accentLight: "#a7f3d0",
    background: "#ecfdf5",
    border: "#a7f3d0",
    text: "#065f46",
  },
  warning: {
    accent: "#d97706",
    accentLight: "#fde68a",
    background: "#fffbeb",
    border: "#fde68a",
    text: "#92400e",
  },
  danger: {
    accent: "#dc2626",
    accentLight: "#fecaca",
    background: "#fef2f2",
    border: "#fecaca",
    text: "#991b1b",
  },
  security: {
    accent: "#7c3aed",
    accentLight: "#ddd6fe",
    background: "#f5f3ff",
    border: "#ddd6fe",
    text: "#5b21b6",
  },
};

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

export const renderTransactionalEmail = async ({
  name,
  heading,
  message,
  preheader = heading,
  badge = "EventFlow",
  tone = "info",
  details = [],
  highlightTitle,
  highlightText,
  actionLabel,
  actionUrl,
  note,
}: TransactionalEmailOptions) =>
  ejs.renderFile(transactionalTemplatePath, {
    name,
    heading,
    message,
    preheader,
    badge,
    details,
    highlightTitle,
    highlightText,
    actionLabel,
    actionUrl,
    note,
    colors: toneColors[tone],
    year: new Date().getFullYear(),
  });
