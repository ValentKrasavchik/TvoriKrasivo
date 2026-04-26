-- CreateTable
CREATE TABLE "SiteSeo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metaTitle" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "ogTitle" TEXT NOT NULL,
    "ogDescription" TEXT NOT NULL,
    "ogImage" TEXT,
    "canonicalUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "SiteSeo" ("id", "metaTitle", "metaDescription", "ogTitle", "ogDescription", "ogImage", "canonicalUrl", "createdAt", "updatedAt")
VALUES (
  'default',
  'Твори Красиво — Студия керамики в Донецке | Мастер-классы по лепке',
  'Твори Красиво — уютная студия керамики в Донецке. Мастер-классы по лепке для взрослых и детей. Создайте своё первое изделие из глины!',
  'Твори Красиво — Студия керамики в Донецке',
  'Уютная студия керамики. Мастер-классы по лепке для новичков и опытных мастеров.',
  'images/hero.jpg',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
