import { useEffect, useMemo, useState } from 'react';
import { confirmWorkshopRequest, deleteWorkshopRequest, fetchWorkshopRequests, fetchWorkshops, updateWorkshopRequest } from '../lib/api';

type Workshop = { id: string; title: string; capacityPerSlot?: number };
type WorkshopRequest = {
  id: string;
  workshopId: string;
  workshop?: Workshop;
  date: string;
  time: string;
  name: string;
  phone: string;
  messenger: string;
  participants: number;
  comment: string | null;
  status: 'NEW' | 'CONFIRMED' | string;
  createdAt: string;
  confirmedSlotId?: string | null;
};

export default function NewWorkshopRequests() {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [items, setItems] = useState<WorkshopRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<WorkshopRequest | null>(null);
  const [form, setForm] = useState({
    workshopId: '',
    date: '',
    time: '12:00',
    name: '',
    phone: '',
    messenger: '',
    participants: 1,
    comment: '',
  });

  const workshopTitleById = useMemo(
    () => Object.fromEntries(workshops.map((w) => [w.id, w.title])),
    [workshops]
  );

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [w, reqs] = await Promise.all([fetchWorkshops(), fetchWorkshopRequests()]);
      setWorkshops(w || []);
      setItems(reqs || []);
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openEdit(item: WorkshopRequest) {
    setEditing(item);
    setForm({
      workshopId: item.workshopId,
      date: item.date,
      time: item.time,
      name: item.name,
      phone: item.phone,
      messenger: item.messenger,
      participants: item.participants || 1,
      comment: item.comment || '',
    });
  }

  async function onSaveEdit() {
    if (!editing) return;
    setError('');
    try {
      await updateWorkshopRequest(editing.id, {
        workshopId: form.workshopId,
        date: form.date,
        time: form.time,
        name: form.name,
        phone: form.phone,
        messenger: form.messenger,
        participants: form.participants,
        comment: form.comment || null,
      });
      setEditing(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Ошибка сохранения');
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Удалить заявку?')) return;
    setError('');
    try {
      await deleteWorkshopRequest(id);
      if (editing?.id === id) setEditing(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Ошибка удаления');
    }
  }

  async function onConfirm(id: string) {
    if (!confirm('Подтвердить заявку и создать слот?')) return;
    setError('');
    try {
      await confirmWorkshopRequest(id);
      if (editing?.id === id) setEditing(null);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Ошибка подтверждения');
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800 sm:text-2xl">Запись: Новый мастер-класс</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <p className="p-4">Загрузка...</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-slate-500">Заявок нет.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Дата / время</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Мастер-класс</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Клиент</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Статус</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">{r.date} {r.time}</td>
                  <td className="px-4 py-3">{r.workshop?.title || workshopTitleById[r.workshopId] || r.workshopId}</td>
                  <td className="px-4 py-3">
                    <div>{r.name}</div>
                    <div className="text-xs text-slate-500">{r.phone}</div>
                  </td>
                  <td className="px-4 py-3">{r.status === 'NEW' ? 'Новая' : r.status === 'CONFIRMED' ? 'Подтверждена' : r.status}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => openEdit(r)} className="mr-2 text-amber-700 hover:underline">
                      Редактировать
                    </button>
                    {r.status === 'NEW' && (
                      <button type="button" onClick={() => onConfirm(r.id)} className="mr-2 text-green-700 hover:underline">
                        Подтвердить
                      </button>
                    )}
                    <button type="button" onClick={() => onDelete(r.id)} className="text-red-600 hover:underline">
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Редактировать заявку</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-slate-600">Мастер-класс</label>
                <select value={form.workshopId} onChange={(e) => setForm((f) => ({ ...f, workshopId: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2">
                  <option value="">Выберите мастер-класс</option>
                  {workshops.map((w) => (
                    <option key={w.id} value={w.id}>{w.title}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm text-slate-600">Дата</label>
                  <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600">Время</label>
                  <input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-600">Имя</label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-slate-600">Телефон</label>
                <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-slate-600">Мессенджер</label>
                <input type="text" value={form.messenger} onChange={(e) => setForm((f) => ({ ...f, messenger: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-slate-600">Участников</label>
                <input type="number" min={1} value={form.participants} onChange={(e) => setForm((f) => ({ ...f, participants: parseInt(e.target.value, 10) || 1 }))} className="mt-1 w-full rounded border px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm text-slate-600">Комментарий</label>
                <textarea value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} className="mt-1 w-full rounded border px-3 py-2" rows={3} />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={onSaveEdit} className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700">Сохранить</button>
              {editing.status === 'NEW' && (
                <button type="button" onClick={() => onConfirm(editing.id)} className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700">Подтвердить</button>
              )}
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2">Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

