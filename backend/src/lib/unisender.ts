/**
 * Транзакционные письма через Unisender:
 * — **Unisender GO** (goapi): если заданы UNISENDER_API_KEY + UNISENDER_SENDER_EMAIL и **нет** UNISENDER_LIST_ID;
 * — **классический API** (sendEmail + list_id): если задан ещё UNISENDER_LIST_ID.
 * @see https://godocs.unisender.ru/web-api-ref (email/send)
 * @see https://www.unisender.com/ru/support/api/messages/sendemail/ (sendEmail)
 */

const CLASSIC_SEND_EMAIL_URL = 'https://api.unisender.com/ru/api/sendEmail?format=json';

const DEFAULT_GO_BASE = 'https://goapi.unisender.ru/ru/transactional/api/v1';

function goSendEmailUrl(): string {
  const custom = process.env.UNISENDER_GO_SEND_URL?.trim();
  if (custom) return custom.replace(/\/+$/, '');
  const base = (process.env.UNISENDER_GO_BASE_URL?.trim() || DEFAULT_GO_BASE).replace(/\/+$/, '');
  return `${base}/email/send.json`;
}

/** Достаточно ли переменных для отправки через Unisender (GO или классика). */
export function isUnisenderConfigured(): boolean {
  const apiKey = process.env.UNISENDER_API_KEY?.trim();
  const senderEmail = process.env.UNISENDER_SENDER_EMAIL?.trim();
  return Boolean(apiKey && senderEmail);
}

function htmlToPlaintext(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);
}

async function sendBookingEmailViaUnisenderGo(
  recipientEmail: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const apiKey = process.env.UNISENDER_API_KEY!.trim();
  const senderEmail = process.env.UNISENDER_SENDER_EMAIL!.trim();
  const senderName = (process.env.UNISENDER_SENDER_NAME || 'Твори Красиво').trim();

  const plaintext = htmlToPlaintext(htmlBody) || subject;
  const url = goSendEmailUrl();
  const payload = {
    message: {
      recipients: [{ email: recipientEmail }],
      body: { html: htmlBody, plaintext },
      subject,
      from_email: senderEmail,
      from_name: senderName,
      global_language: 'ru',
      template_engine: 'none' as const,
    },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as {
      status?: string;
      job_id?: string;
      message?: string;
      code?: number;
      failed_emails?: Record<string, string>;
    };
    if (!res.ok || data.status !== 'success') {
      console.error('[unisender-go] send failed', res.status, data.message ?? data.code, data);
      return;
    }
    if (data.job_id) {
      console.info('[unisender-go] письмо принято к отправке, job_id=', data.job_id);
    }
    if (data.failed_emails && Object.keys(data.failed_emails).length > 0) {
      console.warn('[unisender-go] часть адресов не принята', data.failed_emails);
    }
  } catch (e) {
    console.error('[unisender-go] request error', e);
  }
}

async function sendBookingEmailViaUnisenderClassic(
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
      '[unisender] классический sendEmail: нужны UNISENDER_API_KEY, UNISENDER_SENDER_EMAIL, UNISENDER_LIST_ID (без list_id используется Unisender GO)'
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
    const res = await fetch(CLASSIC_SEND_EMAIL_URL, {
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

export async function sendBookingEmailViaUnisender(
  recipientEmail: string,
  subject: string,
  htmlBody: string
): Promise<void> {
  const apiKey = process.env.UNISENDER_API_KEY?.trim();
  const senderEmail = process.env.UNISENDER_SENDER_EMAIL?.trim();
  if (!apiKey || !senderEmail) {
    console.warn('[unisender] Задайте UNISENDER_API_KEY и UNISENDER_SENDER_EMAIL');
    return;
  }
  const listId = process.env.UNISENDER_LIST_ID?.trim();
  if (listId) {
    await sendBookingEmailViaUnisenderClassic(recipientEmail, subject, htmlBody);
    return;
  }
  await sendBookingEmailViaUnisenderGo(recipientEmail, subject, htmlBody);
}
