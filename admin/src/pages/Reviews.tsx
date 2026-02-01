import { useState, useEffect } from 'react';
import { fetchReviews, createReview, updateReview, deleteReview } from '../lib/api';

type Review = {
  id: string;
  name: string;
  text: string;
  rating: number;
  date: string;
};

const emptyForm = { name: '', text: '', rating: 5, date: new Date().toISOString().slice(0, 10) };

export default function Reviews() {
  const [list, setList] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ type: 'create' | 'edit'; review?: Review } | null>(null);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchReviews();
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
    setModal({ type: 'create' });
  }

  function openEdit(r: Review) {
    setForm({ name: r.name, text: r.text, rating: r.rating, date: r.date });
    setModal({ type: 'edit', review: r });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (modal?.type === 'create') {
        await createReview(form);
      } else if (modal?.review) {
        await updateReview(modal.review.id, form);
      }
      setModal(null);
      load();
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить отзыв?')) return;
    setError('');
    try {
      await deleteReview(id);
      setModal(null);
      load();
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800 sm:text-2xl">Отзывы гостей</h1>
      <button
        type="button"
        onClick={openCreate}
        className="mb-4 w-full rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 sm:w-auto"
      >
        Добавить отзыв
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
              <p className="text-slate-500">Нет отзывов. Добавьте первый.</p>
            ) : (
              list.map((r) => (
                <div key={r.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="font-medium text-slate-800">{r.name}</span>
                    <span className="shrink-0 text-sm text-amber-600">{r.rating} ★</span>
                  </div>
                  <p className="line-clamp-3 text-sm text-slate-600">{r.text}</p>
                  <p className="mt-2 text-xs text-slate-500">{r.date}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => openEdit(r)} className="text-sm text-amber-700 hover:underline">
                      Изменить
                    </button>
                    <button type="button" onClick={() => handleDelete(r.id)} className="text-sm text-red-600 hover:underline">
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
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Имя</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Текст</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Оценка</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Дата</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-600">{r.text}</td>
                  <td className="px-4 py-3">{r.rating} ★</td>
                  <td className="px-4 py-3">{r.date}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => openEdit(r)} className="mr-2 text-amber-700 hover:underline">
                      Изменить
                    </button>
                    <button type="button" onClick={() => handleDelete(r.id)} className="text-red-600 hover:underline">
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
          <p className="p-4 text-slate-500">Нет отзывов. Добавьте первый.</p>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModal(null)}>
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 font-semibold">{modal.type === 'create' ? 'Новый отзыв' : 'Редактировать отзыв'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600">Имя автора *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600">Текст отзыва *</label>
                <textarea
                  value={form.text}
                  onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2"
                  rows={4}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600">Оценка (1–5)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={form.rating}
                  onChange={(e) => setForm((f) => ({ ...f, rating: parseInt(e.target.value, 10) || 5 }))}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600">Дата</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1 w-full rounded border px-3 py-2"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700">
                  {modal.type === 'create' ? 'Создать' : 'Сохранить'}
                </button>
                <button type="button" onClick={() => setModal(null)} className="rounded-lg border px-4 py-2 text-sm">
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
