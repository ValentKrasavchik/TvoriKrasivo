/** Допустимые ключи иконок (SVG на фронте; custom — своё изображение в customIconUrl) */
export const CONTACT_ICON_KEYS = [
  'map',
  'phone',
  'telegram',
  'max',
  'clock',
  'mail',
  'instagram',
  'link',
  'message',
  'custom',
] as const;

export type ContactIconKey = (typeof CONTACT_ICON_KEYS)[number];

export function isAllowedContactIconKey(key: string): key is ContactIconKey {
  return (CONTACT_ICON_KEYS as readonly string[]).includes(key);
}

/** Разрешённые URL своей иконки (загрузка в uploads через API) */
export function isAllowedCustomIconUrl(url: string): boolean {
  const s = String(url || '').trim();
  if (!s || s.length > 500) return false;
  if (s.startsWith('/api/uploads/')) return true;
  if (s.startsWith('https://') || s.startsWith('http://')) {
    try {
      const u = new URL(s);
      return u.pathname.startsWith('/api/uploads/');
    } catch {
      return false;
    }
  }
  return false;
}

/** tel:, http(s):, mailto: */
export function isAllowedContactHref(href: string): boolean {
  const s = String(href).trim();
  if (!s || s.length > 800) return false;
  if (s.startsWith('tel:')) {
    return /^tel:\+?[0-9()\s\-]+$/.test(s) && /\d/.test(s);
  }
  if (s.startsWith('mailto:')) {
    return s.length > 7 && !/\s/.test(s.slice(7));
  }
  if (s.startsWith('https://') || s.startsWith('http://')) {
    try {
      const u = new URL(s);
      return Boolean(u.hostname);
    } catch {
      return false;
    }
  }
  return false;
}
