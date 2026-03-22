-- CreateTable
CREATE TABLE "ContactBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "blockType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT,
    "href" TEXT,
    "variant" TEXT,
    "iconKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Начальные данные (как в data/workshops.json)
INSERT INTO "ContactBlock" ("id", "sortOrder", "blockType", "label", "value", "href", "variant", "iconKey", "createdAt", "updatedAt") VALUES
('cb000000-0001-4000-8000-000000000001', 0, 'FIELD', 'Адрес', 'Донецк, ул. Розы Люксембург 75А, этаж 5, каб. 507', NULL, NULL, 'map', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cb000000-0002-4000-8000-000000000002', 1, 'FIELD', 'Телефон', '+7 (949) 347-57-53', NULL, NULL, 'phone', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cb000000-0003-4000-8000-000000000003', 2, 'FIELD', 'Telegram', '@Tvorikrasivo_ceramics', NULL, NULL, 'telegram', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cb000000-0004-4000-8000-000000000004', 3, 'FIELD', 'Время работы', 'Пн–Пт: 10:00 – 20:00' || char(10) || 'Сб–Вс: 11:00 – 19:00', NULL, NULL, 'clock', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cb000000-0005-4000-8000-000000000005', 4, 'BUTTON', 'Написать в Telegram', NULL, 'https://t.me/Tvorikrasivo_ceramics', 'primary', 'telegram', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('cb000000-0006-4000-8000-000000000006', 5, 'BUTTON', 'Позвонить', NULL, 'tel:+79493475753', 'secondary', 'phone', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
