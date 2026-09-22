import httpStatus from "http-status";
import config from "../config";
import { AppError } from "../utils/AppError";

type UddoktaCreatePayload = {
  full_name: string;
  email: string;
  amount: string;
  metadata: Record<string, string>;
  redirect_url: string;
  return_type?: "GET" | "POST";
  cancel_url: string;
  webhook_url: string;
};

export type UddoktaVerifyResponse = {
  status?: string;
  invoice_id?: string;
  transaction_id?: string;
  payment_method?: string;
  sender_number?: string;
  amount?: string | number;
  fee?: string | number;
  charged_amount?: string | number;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

const request = async <T>(path: string, body: Record<string, unknown>) => {
  if (!config.uddoktapay_api_key) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "UddoktaPay is not configured",
    );
  }

  const response = await fetch(
    `${config.uddoktapay_base_url.replace(/\/$/, "")}${path}`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "RT-UDDOKTAPAY-API-KEY": config.uddoktapay_api_key,
      },
      body: JSON.stringify(body),
    },
  );

  const data = (await response.json().catch(() => ({}))) as T;

  if (!response.ok) {
    throw new AppError(httpStatus.BAD_GATEWAY, "UddoktaPay request failed");
  }

  return data;
};

export const createUddoktaPayment = async (payload: UddoktaCreatePayload) => {
  const result = await request<{
    status?: boolean;
    payment_url?: string;
    invoice_id?: string;
    message?: string;
  }>("/api/checkout-v2", {
    ...payload,
    return_type: payload.return_type ?? "GET",
  });

  if (!result.status || !result.payment_url) {
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      result.message ?? "UddoktaPay did not return a payment URL",
    );
  }

  return result;
};

export const verifyUddoktaPayment = async (invoiceId: string) =>
  request<UddoktaVerifyResponse>("/api/verify-payment", {
    invoice_id: invoiceId,
  });
