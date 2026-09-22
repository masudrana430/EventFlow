import config from "../config";

type ResendErrorPayload = {
  message?: string;
  name?: string;
  statusCode?: number;
};

export const sendEmail = async (payload: {
  to: string;
  subject: string;
  html: string;
}) => {
  if (!config.resend_api_key) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  if (!config.email_sender) {
    throw new Error("EMAIL_SENDER is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.resend_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `EventFlow <${config.email_sender}>`,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });

    const result = (await response.json().catch(() => ({}))) as
      | ResendErrorPayload
      | { id?: string };

    if (!response.ok) {
      const message =
        "message" in result && result.message
          ? result.message
          : `Resend API returned HTTP ${response.status}`;

      throw new Error(message);
    }

    return result;
  } finally {
    clearTimeout(timeout);
  }
};

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
