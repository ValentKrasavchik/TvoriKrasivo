import { useState, useEffect, useRef } from 'react';
import { fetchContacts, saveContacts, uploadImage, fullImageUrl, type ContactBlockDto } from '../lib/api';

const ICON_OPTIONS: { value: string; label: string }[] = [
  { value: 'map', label: 'Адрес / карта' },
  { value: 'phone', label: 'Телефон' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'max', label: 'Max' },
  { value: 'clock', label: 'Часы' },
  { value: 'mail', label: 'Почта' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'message', label: 'Сообщение' },
  { value: 'link', label: 'Ссылка' },
  { value: 'custom', label: 'Своя (загрузить файл)' },
];

const DEFAULT_BLOCKS: Omit<ContactBlockDto, 'id' | 'sortOrder'>[] = [
  {
    blockType: 'FIELD',
    label: 'Адрес',
    value: 'Донецк, ул. Розы Люксембург 75А, этаж 5, каб. 507',
    href: null,
    variant: null,
    iconKey: 'map',
    customIconUrl: null,
  },
  {
    blockType: 'FIELD',
    label: 'Телефон',
    value: '+7 (949) 347-57-53',
    href: null,
    variant: null,
    iconKey: 'phone',
    customIconUrl: null,
  },
  {
    blockType: 'FIELD',
    label: 'Telegram',
    value: '@Tvorikrasivo_ceramics',
    href: null,
    variant: null,
    iconKey: 'telegram',
    customIconUrl: null,
  },
  {
    blockType: 'FIELD',
    label: 'Время работы',
    value: 'Пн–Пт: 10:00 – 20:00\nСб–Вс: 11:00 – 19:00',
    href: null,
    variant: null,
    iconKey: 'clock',
    customIconUrl: null,
  },
  {
    blockType: 'BUTTON',
    label: 'Написать в Telegram',
    value: null,
    href: 'https://t.me/Tvorikrasivo_ceramics',
    variant: 'primary',
    iconKey: 'telegram',
    customIconUrl: null,
  },
  {
    blockType: 'BUTTON',
    label: 'Позвонить',
    value: null,
    href: 'tel:+79493475753',
    variant: 'secondary',
    iconKey: 'phone',
    customIconUrl: null,
  },
];

type DraftBlock = {
  /** Стабильный ключ для React (не индекс массива) */
  rowKey: string;
  blockType: 'FIELD' | 'BUTTON';
  label: string;
  value: string;
  href: string;
  variant: 'primary' | 'secondary';
  iconKey: string;
  customIconUrl: string;
};

function fromApi(blocks: ContactBlockDto[]): DraftBlock[] {
  return blocks.map((b) => ({
    rowKey: b.id ?? crypto.randomUUID(),
    blockType: b.blockType,
    label: b.label,
    value: b.value ?? '',
    href: b.href ?? '',
    variant: b.variant === 'secondary' ? 'secondary' : 'primary',
    iconKey: b.iconKey,
    customIconUrl: b.customIconUrl ?? '',
  }));
}

function toPayload(draft: DraftBlock[]): Omit<ContactBlockDto, 'id' | 'sortOrder'>[] {
  return draft.map((b) => {
    const base = {
      blockType: b.blockType,
      label: b.label.trim(),
      iconKey: b.iconKey,
      customIconUrl: b.iconKey === 'custom' ? (b.customIconUrl.trim() || null) : null,
    };
    if (b.blockType === 'FIELD') {
      return {
        ...base,
        value: b.value,
        href: null,
        variant: null,
      };
    }
    return {
      ...base,
      value: null,
      href: b.href.trim(),
      variant: b.variant,
    };
  });
}

export default function Contacts() {
  const [draft, setDraft] = useState<DraftBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingRowKey, setUploadingRowKey] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchContacts();
      setDraft(fromApi(data.blocks));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      setDraft([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateAt(index: number, patch: Partial<DraftBlock>) {
    setDraft((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= draft.length) return;
    setDraft((prev) => {
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  function remove(index: number) {
    if (!confirm('Удалить этот блок?')) return;
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function addField() {
    setDraft((prev) => [
      ...prev,
      {
        rowKey: crypto.randomUUID(),
        blockType: 'FIELD',
        label: '',
        value: '',
        href: '',
        variant: 'primary',
        iconKey: 'link',
        customIconUrl: '',
      },
    ]);
  }

  function addButton() {
    setDraft((prev) => [
      ...prev,
      {
        rowKey: crypto.randomUUID(),
        blockType: 'BUTTON',
        label: '',
        value: '',
        href: 'https://',
        variant: 'primary',
        iconKey: 'link',
        customIconUrl: '',
      },
    ]);
  }

  function resetDefaults() {
    if (!confirm('Заменить текущий список стандартным набором?')) return;
    setDraft(
      DEFAULT_BLOCKS.map((b) => ({
        rowKey: crypto.randomUUID(),
        blockType: b.blockType,
        label: b.label,
        value: b.value ?? '',
        href: b.href ?? '',
        variant: b.variant === 'secondary' ? 'secondary' : 'primary',
        iconKey: b.iconKey,
        customIconUrl: b.customIconUrl ?? '',
      }))
    );
  }

  async function handleIconUpload(rowKey: string, file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) {
      setError('Выберите файл изображения (PNG, JPG, SVG, WebP…)');
      return;
    }
    setError('');
    setUploadingRowKey(rowKey);
    try {
      const { url } = await uploadImage(file);
      setDraft((prev) =>
        prev.map((row) =>
          row.rowKey === rowKey ? { ...row, iconKey: 'custom', customIconUrl: url } : row
        )
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setUploadingRowKey(null);
    }
  }

  async function handleSave() {
    for (let i = 0; i < draft.length; i++) {
      const b = draft[i];
      if (!b.label.trim()) {
        setError(`Укажите заголовок у блока ${i + 1}`);
        return;
      }
      if (b.blockType === 'BUTTON' && !b.href.trim()) {
        setError(`Укажите ссылку у кнопки «${b.label || '(без названия)'}»`);
        return;
      }
      if (b.iconKey === 'custom' && !b.customIconUrl.trim()) {
        setError(`Блок ${i + 1}: для «Своя иконка» загрузите изображение`);
        return;
      }
    }
    setError('');
    setSaving(true);
    try {
      const data = await saveContacts(toPayload(draft));
      setDraft(fromApi(data.blocks));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800 sm:text-2xl">Контакты</h1>
      <p className="mb-4 max-w-2xl text-sm text-slate-600">
        Блоки отображаются в секции «Контакты» на главной странице: строки с полем «Заголовок» и текстом, либо кнопки со
        ссылкой. Порядок на сайте совпадает со списком ниже (сверху вниз). После кнопок «Вверх» / «Вниз» обязательно
        нажмите «Сохранить на сайт», иначе изменения не попадут на главную. Для пункта «Своя иконка» загрузите квадратное
        изображение (логотип до ~200×200 px).
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || loading}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {saving ? 'Сохранение…' : 'Сохранить на сайт'}
        </button>
        <button
          type="button"
          onClick={addField}
          disabled={loading}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          + Строка
        </button>
        <button
          type="button"
          onClick={addButton}
          disabled={loading}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          + Кнопка
        </button>
        <button
          type="button"
          onClick={resetDefaults}
          disabled={loading}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
        >
          Сбросить к стандартным
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="p-4">Загрузка...</p>
      ) : draft.length === 0 ? (
        <p className="text-slate-500">Нет блоков. Добавьте строку или кнопку, либо нажмите «Сбросить к стандартным».</p>
      ) : (
        <div className="space-y-4">
          {draft.map((b, i) => (
            <div
              key={b.rowKey}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {b.blockType === 'FIELD' ? 'Строка контактов' : 'Кнопка'}
                </span>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                  >
                    Вверх
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    onClick={() => move(i, 1)}
                    disabled={i === draft.length - 1}
                  >
                    Вниз
                  </button>
                  <button
                    type="button"
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    onClick={() => remove(i)}
                  >
                    Удалить
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="text-slate-600">Заголовок</span>
                  <input
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                    value={b.label}
                    onChange={(e) => updateAt(i, { label: e.target.value })}
                    placeholder="Например: Адрес"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-600">Иконка</span>
                  <select
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                    value={b.iconKey}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateAt(i, {
                        iconKey: v,
                        ...(v !== 'custom' ? { customIconUrl: '' } : {}),
                      });
                    }}
                  >
                    {ICON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {b.iconKey === 'custom' && (
                <div className="mt-3 rounded border border-dashed border-slate-300 bg-slate-50 p-3">
                  <p className="mb-2 text-xs text-slate-600">Загрузка своей иконки</p>
                  <input
                    ref={(el) => {
                      fileRefs.current[b.rowKey] = el;
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleIconUpload(b.rowKey, e.target.files?.[0])}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={uploadingRowKey === b.rowKey}
                      onClick={() => fileRefs.current[b.rowKey]?.click()}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    >
                      {uploadingRowKey === b.rowKey ? 'Загрузка…' : 'Выбрать файл'}
                    </button>
                    {b.customIconUrl ? (
                      <img
                        src={fullImageUrl(b.customIconUrl)}
                        alt=""
                        className="h-12 w-12 rounded border border-slate-200 object-contain"
                      />
                    ) : (
                      <span className="text-xs text-amber-700">Файл ещё не выбран</span>
                    )}
                  </div>
                </div>
              )}

              {b.blockType === 'FIELD' ? (
                <label className="mt-3 block text-sm">
                  <span className="text-slate-600">Текст (несколько строк — с новой строки)</span>
                  <textarea
                    className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                    rows={4}
                    value={b.value}
                    onChange={(e) => updateAt(i, { value: e.target.value })}
                    placeholder="Текст под заголовком. Для Max можно вставить ссылку https://…"
                  />
                </label>
              ) : (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="text-slate-600">Ссылка</span>
                    <input
                      className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                      value={b.href}
                      onChange={(e) => updateAt(i, { href: e.target.value })}
                      placeholder="https://… или tel:+7…"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-slate-600">Стиль кнопки</span>
                    <select
                      className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                      value={b.variant}
                      onChange={(e) =>
                        updateAt(i, { variant: e.target.value === 'secondary' ? 'secondary' : 'primary' })
                      }
                    >
                      <option value="primary">Основная (заливка)</option>
                      <option value="secondary">Вторичная (контур)</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
