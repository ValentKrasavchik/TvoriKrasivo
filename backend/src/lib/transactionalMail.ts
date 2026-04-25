import { sendBookingEmailViaSmtp, isSmtpConfigured } from './smtpBookingMail';
import { sendBookingEmailViaUnisender } from './unisender';

/**
 * Одно HTML-письмо гостю:
 * — если на сервере задан SMTP (SMTP_HOST + отправитель), шлём **через SMTP**;
 * — иначе, если настроен Unisender — через него;
 * — иначе предупреждение в лог.
 */
export async function sendHtmlTransactionalEmail(to: string, subject: string, html: string): Promise<void> {
  if (isSmtpConfigured()) {
    await sendBookingEmailViaSmtp(to, subject, html);
    return;
  }
  await sendBookingEmailViaUnisender(to, subject, html);
}
