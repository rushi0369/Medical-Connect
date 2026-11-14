import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const API_BASE = 'https://api.razorpay.com/v1';

/** UPI uses Store QR code (or Razorpay when credentials are present). */
export const isUpiConfigured = () => true;

async function callRazorpay(method, path, body) {
  if (!isUpiConfigured()) {
    throw new AppError(503, 'UPI_NOT_CONFIGURED', 'UPI payments are not set up yet. Please choose cash on delivery.');
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error(`Razorpay request failed: ${error.message}`);
    throw new AppError(502, 'PAYMENT_GATEWAY_UNAVAILABLE', 'The payment service could not be reached. Please try again.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`Razorpay ${method} ${path} answered ${response.status}: ${data.error?.description ?? 'no detail'}`);
    throw new AppError(502, 'PAYMENT_GATEWAY_ERROR', 'The payment service could not complete this. Please try again.');
  }
  return data;
}

/** Creates an order-specific payment link, which the customer can pay by UPI. */
export async function createPaymentLink({ amountPaise, referenceId, description, customerName, customerPhone }) {
  const link = await callRazorpay('POST', '/payment_links', {
    amount: amountPaise,
    currency: 'INR',
    accept_partial: false,
    reference_id: referenceId,
    description,
    customer: { name: customerName, contact: `+91${customerPhone}` },
    notify: { sms: false, email: false },
    reminder_enable: false,
  });
  return { id: link.id, url: link.short_url };
}

/** Asks the gateway directly whether a link was paid. Returns the captured payment, if any. */
export async function fetchPaidPayment(linkId) {
  const link = await callRazorpay('GET', `/payment_links/${encodeURIComponent(linkId)}`);
  if (link.status !== 'paid') return null;

  const captured = (link.payments ?? []).find((payment) => payment.status === 'captured');
  return captured ? { paymentId: captured.payment_id, amountPaise: captured.amount } : null;
}

export async function cancelPaymentLink(linkId) {
  await callRazorpay('POST', `/payment_links/${encodeURIComponent(linkId)}/cancel`);
}

/**
 * Proves a webhook really came from Razorpay: it must be signed with our secret.
 * Compared in constant time so the signature cannot be guessed byte by byte.
 */
export function verifyWebhookSignature(rawBody, signature) {
  if (!env.RAZORPAY_WEBHOOK_SECRET || typeof signature !== 'string') return false;

  const expected = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  const given = Buffer.from(signature, 'utf8');
  const wanted = Buffer.from(expected, 'utf8');
  return given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
}
