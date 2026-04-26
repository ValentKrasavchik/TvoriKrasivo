import { sendBookingEmailViaSmtp, isSmtpConfigured } from './smtpBookingMail';
import { sendBookingEmailViaUnisender, isUnisenderConfigured } from './unisender';

/**
 * Одно HTML-письмо гостю:
 * — при UNISENDER_API_KEY + UNISENDER_SENDER_EMAIL — **Unisender** (GO без list_id, классика с UNISENDER_LIST_ID);
 * — иначе при настроенном SMTP — через SMTP;
 * — иначе лог (см. unisender / smtp-booking).
 */
export async function sendHtmlTransactionalEmail(to: string, subject: string, html: string): Promise<void> {
  if (isUnisenderConfigured()) {
    await sendBookingEmailViaUnisender(to, subject, html);
    return;
  }
  if (isSmtpConfigured()) {
    await sendBookingEmailViaSmtp(to, subject, html);
    return;
  }
  await sendBookingEmailViaUnisender(to, subject, html);
}
