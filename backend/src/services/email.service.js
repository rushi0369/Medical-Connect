import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    })
  : null;

async function sendEmail({ to, subject, text }) {
  if (transporter) {
    await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, text });
    return;
  }

  if (env.NODE_ENV === 'production') {
    console.error('Email is not set up, so a message could not be sent. Set SMTP_HOST in the backend settings.');
    return;
  }

  // Development without an email account: show the message in the backend window.
  console.info(`\n--- Email not sent (no SMTP_HOST set) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n---\n`);
}

export function sendPasswordResetEmail({ to, fullName, resetUrl }) {
  return sendEmail({
    to,
    subject: 'Reset your CK Medical password',
    text: [
      `Hello ${fullName},`,
      '',
      'We received a request to reset your CK Medical password. Open this link to choose a new one:',
      '',
      resetUrl,
      '',
      'This link works once and expires in 1 hour.',
      'If you did not ask for this, you can ignore this email and your password will stay the same.',
    ].join('\n'),
  });
}
