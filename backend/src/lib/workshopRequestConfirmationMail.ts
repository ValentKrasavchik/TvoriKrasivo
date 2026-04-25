import { escapeHtml, formatPriceRub } from './bookingEmailTemplate';
import { sendHtmlTransactionalEmail } from './transactionalMail';

export type WorkshopRequestEmailPayload = {
  recipientEmail: string;
  workshopTitle: string;
  priceRub: number;
  date: string;
  time: string;
  name: string;
  phone: string;
  messenger: string;
  participants: number;
  comment: string | null;
};

const SUBJECT = 'Заявка «Хочу мастер-класс» — Твори Красиво';

function buildWorkshopRequestEmailHtml(p: WorkshopRequestEmailPayload): string {
  const rows: [string, string][] = [
    ['Мастер-класс', p.workshopTitle],
    ['Стоимость', formatPriceRub(p.priceRub)],
    ['Желаемая дата', p.date],
    ['Желаемое время', p.time],
    ['Имя', p.name],
    ['Телефон', p.phone],
    ['Email', p.recipientEmail],
    ['Связь', p.messenger],
    ['Участников', String(p.participants)],
    ['Комментарий', p.comment?.trim() ? p.comment.trim() : '—'],
  ];
  const bodyRows = rows
    .map(
      ([k, v]) => `
<tr>
  <td style="padding:14px 18px;border-bottom:1px solid #eee8e0;font-size:14px;color:#6b5344;width:38%;vertical-align:top;font-family:Georgia,'Times New Roman',serif;">
    ${escapeHtml(k)}
  </td>
  <td style="padding:14px 18px;border-bottom:1px solid #eee8e0;font-size:15px;color:#2c2419;font-weight:600;vertical-align:top;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    ${escapeHtml(v)}
  </td>
</tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f5f0ea;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f0ea;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(44,36,25,0.08);">
        <tr><td bgcolor="#8b6914" style="background-color:#8b6914;background:linear-gradient(135deg,#a67c52 0%,#8b6914 100%);padding:28px 24px;text-align:center;">
          <p style="margin:0;font-family:Georgia,serif;font-size:22px;color:#fffefe;">Твори Красиво</p>
          <p style="margin:8px 0 0;font-size:13px;color:rgba(255,254,254,0.88);">заявка на мастер-класс</p>
        </td></tr>
        <tr><td style="padding:28px 24px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
          <p style="margin:0 0 12px;font-size:18px;color:#2c2419;">Здравствуйте, ${escapeHtml(p.name)}!</p>
          <p style="margin:0;font-size:15px;line-height:1.55;color:#5c4d3d;">Мы получили вашу заявку «Хочу мастер-класс» на удобное вам время. Ниже — краткие данные. После проверки администратор свяжется с вами.</p>
        </td></tr>
        <tr><td style="padding:8px 16px 24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e8dfd4;border-radius:8px;background:#fffdfb;">${bodyRows}</table>
        </td></tr>
        <tr><td style="padding:0 24px 28px;font-size:13px;color:#8a7a6a;">Если заявку оставили не вы — проигнорируйте письмо.</td></tr>
        <tr><td style="background-color:#faf7f4;padding:20px 24px;border-top:1px solid #eee8e0;text-align:center;font-size:13px;color:#6b5344;">
          <strong style="color:#2c2419;">Студия «Твори Красиво»</strong>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendWorkshopRequestConfirmationEmail(p: WorkshopRequestEmailPayload): Promise<void> {
  const html = buildWorkshopRequestEmailHtml(p);
  await sendHtmlTransactionalEmail(p.recipientEmail, SUBJECT, html);
}
