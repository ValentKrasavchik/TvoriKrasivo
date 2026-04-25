import nodemailer from 'nodemailer';

/** Явный запрет SMTP (например, пока тестируете только Unisender). */
export function isSmtpExplicitlyDisabled(): boolean {
  const v = process.env.BOOKING_SMTP_ENABLED?.trim().toLowerCase();
  return v === '0' || v === 'false' || v === 'no' || v === 'off';
}

/** Достаточно ли настроек для отправки через SMTP на сервере. */
export function isSmtpConfigured(): boolean {
  if (isSmtpExplicitlyDisabled()) return false;
  const host = process.env.SMTP_HOST?.trim();
  const from =
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    process.env.UNISENDER_SENDER_EMAIL?.trim();
  return Boolean(host && from);
}

/**
 * Отправка HTML-письма через SMTP сервера. Не бросает наружу — только логи.
 */
export async function sendBookingEmailViaSmtp(
  recipientEmail: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    console.warn('[smtp-booking] не задан SMTP_HOST');
    return;
  }

  const port = parseInt(process.env.SMTP_PORT || '587', 10) || 587;
  const secure =
    process.env.SMTP_SECURE?.trim().toLowerCase() === 'true' ||
    process.env.SMTP_SECURE?.trim() === '1' ||
    port === 465;
  const user = process.env.SMTP_USER?.trim() || undefined;
  const pass =
    process.env.SMTP_PASS?.trim() || process.env.SMTP_PASSWORD?.trim() || undefined;
  const from =
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    process.env.UNISENDER_SENDER_EMAIL?.trim();
  if (!from) {
    console.warn('[smtp-booking] Укажите SMTP_FROM или SMTP_USER (адрес отправителя)');
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user && pass ? { auth: { user, pass } } : {}),
  });

  try {
    const info = await transporter.sendMail({
      from: `"${(process.env.SMTP_FROM_NAME || process.env.UNISENDER_SENDER_NAME || 'Твори Красиво').trim()}" <${from}>`,
      to: recipientEmail,
      subject,
      html: htmlBody,
    });
    console.info('[smtp-booking] отправлено', { to: recipientEmail, messageId: info.messageId });
  } catch (e) {
    console.error('[smtp-booking] ошибка отправки', e);
  }
}
