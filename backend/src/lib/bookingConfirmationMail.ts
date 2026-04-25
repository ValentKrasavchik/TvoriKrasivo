import { BOOKING_CONFIRMATION_SUBJECT, buildBookingEmailHtml, type BookingEmailPayload } from './bookingEmailTemplate';
import { sendHtmlTransactionalEmail } from './transactionalMail';

export type { BookingEmailPayload };

/** Уведомление гостю о записи на мастер-класс (SMTP или Unisender — см. transactionalMail). */
export async function sendBookingConfirmationEmail(p: BookingEmailPayload): Promise<void> {
  const html = buildBookingEmailHtml(p);
  await sendHtmlTransactionalEmail(p.recipientEmail, BOOKING_CONFIRMATION_SUBJECT, html);
}
