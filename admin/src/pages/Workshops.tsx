import { useState, useEffect, useRef } from 'react';
import { fetchWorkshops, createWorkshop, updateWorkshop, deleteWorkshop, uploadImage, fullImageUrl } from '../lib/api';

type Workshop = {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  capacityPerSlot: number;
  result: string;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
};

const emptyForm = {
  title: '',
  description: '',
  durationMinutes: 120,
  capacityPerSlot: 6,
  result: '',
  price: 0,
  imageUrl: null as string | null,
  isActive: true,
};

export default function Workshops() {
  const [list, setList] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ type: 'create' | 'edit'; workshop?: Workshop } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [priceInput, setPriceInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchWorkshops();
      setList(data);
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки');
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setPriceInput('');
    setModal({ type: 'create' });
  }

  function openEdit(w: Workshop) {
    setForm({
      title: w.title,
      description: w.description,
      durationMinutes: w.durationMinutes,
      capacityPerSlot: w.capacityPerSlot,
      result: w.result,
      price: w.price,
      imageUrl: w.imageUrl ?? null,
      isActive: w.isActive,
    });
    setPriceInput(String(w.price));
    setModal({ type: 'edit', workshop: w });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const price = priceInput === '' ? 0 : Math.max(0, parseInt(priceInput, 10) || 0);
    try {
      if (modal?.type === 'create') {
        await createWorkshop({ ...form, price });
      } else if (modal?.workshop) {
        await updateWorkshop(modal.workshop.id, { ...form, price });
      }
      setModal(null);
      load();
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Выберите файл изображения (JPG, PNG и т.д.)');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить мастер-класс? Слоты и записи тоже будут затронуты.')) return;
    setError('');
    try {
      await deleteWorkshop(id);
      setModal(null);
      load();
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800 sm:text-2xl">Мастер-классы</h1>
      <button
        type="button"
        onClick={openCreate}
        className="mb-4 w-full rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 sm:w-auto"
      >
        Добавить мастер-класс
      </button>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <p className="p-4">Загрузка...</p>
        ) : (
          <>
          {/* Карточки для мобильных и планшетов */}
          <div className="space-y-3 p-4 md:hidden">
            {list.length === 0 ? (
              <p className="text-slate-500">Нет мастер-классов. Добавьте первый.</p>
            ) : (
              list.map((w) => (
                <div key={w.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 flex items-start gap-3">
                    {w.imageUrl ? (
                      <img
                        src={fullImageUrl(w.imageUrl as string)}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-slate-200 text-slate-400">—</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-800">{w.title}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                        <span>{w.durationMinutes} мин</span>
                        <span>Вместимость: {w.capacityPerSlot}</span>
                        <span>{w.price} ₽</span>
                        <span>{w.isActive ? 'Активен' : 'Неактивен'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(w)}
                      className="text-sm text-amber-700 hover:underline"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(w.id)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <table className="hidden w-full text-sm md:table">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Фото</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Название</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Длительность</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Вместимость</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Цена</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Активен</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {w.imageUrl ? (
                      <img
                        src={fullImageUrl(w.imageUrl as string)}
                        alt=""
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{w.title}</td>
                  <td className="px-4 py-3">{w.durationMinutes} мин</td>
                  <td className="px-4 py-3">{w.capacityPerSlot}</td>
                  <td className="px-4 py-3">{w.price} ₽</td>
                  <td className="px-4 py-3">{w.isActive ? 'Да' : 'Нет'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openEdit(w)}
                      className="mr-2 text-amber-700 hover:underline"
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(w.id)}
                      className="text-red-600 hover:underline"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
        {!loading && list.length === 0 && (
          <p className="p-4 text-slate-500">Нет мастер-классов. Добавьте первый.</p>
        )}
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 font-semibold">
              {modal.type === 'create' ? 'Новый мастер-класс' : 'Редактировать'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Картинка — первым, чтобы было видно */}
              <div className="rounded-lg border-2 border-dashed border-amber-200 bg-amber-50/50 p-3">
                <label className="block text-sm font-medium text-slate-700">Картинка мастер-класса</label>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="rounded-lg border-2 border-amber-400 bg-amber-100 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-200 disabled:opacity-50"
                  >
                    {uploading ? 'Загрузка...' : '➕ Выбрать картинку'}
                  </button>
                  {form.imageUrl && (
                    <>
                      <img
                        src={fullImageUrl(form.imageUrl)}
                        alt=""
                        className="h-20 w-20 rounded border-2 border-amber-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, imageUrl: null }))}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Удалить
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600">Название</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600">Описание</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm text-slate-600">Длительность (мин)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.durationMinutes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, durationMinutes: parseInt(e.target.value, 10) || 120 }))
                    }
                    className="mt-1 w-full rounded border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600">Вместимость слота</label>
                  <input
                    type="number"
                    min={1}
                    value={form.capacityPerSlot}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, capacityPerSlot: parseInt(e.target.value, 10) || 6 }))
                    }
                    className="mt-1 w-full rounded border px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600">Результат (что получит участник)</label>
                <input
                  type="text"
                  value={form.result}
                  onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600">Цена (₽)</label>
                <input
                  type="number"
                  min={0}
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  onFocus={() => modal?.type === 'create' && priceInput === '0' && setPriceInput('')}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              {modal.type === 'edit' && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  <span className="text-sm">Активен (показывать на сайте)</span>
                </label>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700"
                >
                  {modal.type === 'create' ? 'Создать' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
