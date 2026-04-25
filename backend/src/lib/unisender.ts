/**
 * Отправка одиночного письма через HTTP API Unisender (sendEmail).
 * @see https://www.unisender.com/ru/support/api/messages/sendemail/
 */

const SEND_EMAIL_URL = 'https://api.unisender.com/ru/api/sendEmail?format=json';

export async function sendBookingEmailViaUnisender(
  recipientEmail: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const apiKey = process.env.UNISENDER_API_KEY?.trim();
  const senderEmail = process.env.UNISENDER_SENDER_EMAIL?.trim();
  const senderName = (process.env.UNISENDER_SENDER_NAME || 'Твори Красиво').trim();
  const listId = process.env.UNISENDER_LIST_ID?.trim();

  if (!apiKey || !senderEmail || !listId) {
    console.warn(
      '[unisender] Пропуск отправки: задайте UNISENDER_API_KEY, UNISENDER_SENDER_EMAIL, UNISENDER_LIST_ID (или SMTP_HOST на сервере для отправки через SMTP)'
    );
    return;
  }

  const params = new URLSearchParams();
  params.set('api_key', apiKey);
  params.set('email', recipientEmail);
  params.set('sender_name', senderName);
  params.set('sender_email', senderEmail);
  params.set('subject', subject);
  params.set('body', htmlBody);
  params.set('list_id', listId);
  params.set('lang', 'ru');

  try {
    const res = await fetch(SEND_EMAIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: params.toString(),
    });
    const data = (await res.json()) as { result?: { email_id?: string }; error?: string; code?: string };
    if (!res.ok || data.error) {
      console.error('[unisender] sendEmail failed', res.status, data.error || data.code, data);
      return;
    }
    if (data.result?.email_id) {
      console.info('[unisender] письмо поставлено в очередь, email_id=', data.result.email_id);
    }
  } catch (e) {
    console.error('[unisender] sendEmail request error', e);
  }
}
