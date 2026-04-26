/** Единственная строка настроек SEO главной страницы */
export const SITE_SEO_ID = 'default' as const;

export type SiteSeoPayload = {
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string | null;
  canonicalUrl: string | null;
};

export const DEFAULT_SITE_SEO: SiteSeoPayload = {
  metaTitle: 'Твори Красиво — Студия керамики в Донецке | Мастер-классы по лепке',
  metaDescription:
    'Твори Красиво — уютная студия керамики в Донецке. Мастер-классы по лепке для взрослых и детей. Создайте своё первое изделие из глины!',
  ogTitle: 'Твори Красиво — Студия керамики в Донецке',
  ogDescription: 'Уютная студия керамики. Мастер-классы по лепке для новичков и опытных мастеров.',
  ogImage: 'images/hero.jpg',
  canonicalUrl: null,
};

export function rowToPayload(row: {
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string | null;
  canonicalUrl: string | null;
}): SiteSeoPayload {
  return {
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    ogTitle: row.ogTitle,
    ogDescription: row.ogDescription,
    ogImage: row.ogImage ?? null,
    canonicalUrl: row.canonicalUrl ?? null,
  };
}
