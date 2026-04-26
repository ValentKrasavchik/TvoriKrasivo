/** Время слота для отображения (из БД может приходить «12:00:00»). */
export function slotTimeHM(t: string): string {
  if (!t) return '';
  const m = /^(\d{1,2}:\d{2})/.exec(t);
  return m ? m[1] : t.slice(0, 5);
}

/** Когда клиент отправил заявку (Europe/Moscow). */
export function formatSubmittedAt(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
