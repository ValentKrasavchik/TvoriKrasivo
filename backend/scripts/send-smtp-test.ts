/**
 * Тест SMTP: npm run email:test -- recipient@example.com
 */
import 'dotenv/config';
import { sendBookingEmailViaSmtp } from '../src/lib/smtpBookingMail';

const to = process.argv[2];
if (!to) {
  console.error('Укажите email: npm run email:test -- you@example.com');
  process.exit(1);
}

void (async () => {
  await sendBookingEmailViaSmtp(
    to,
    'Тест: студия «Твори Красиво»',
    '<p>Это тестовое письмо с бэкенда (SMTP).</p><p>Если вы его видите — доставка работает.</p>'
  );
  process.exit(0);
})();
