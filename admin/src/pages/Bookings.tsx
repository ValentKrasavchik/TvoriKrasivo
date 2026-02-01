import { useState, useEffect } from 'react';
import { fetchBookings, confirmBooking, approveBooking, rejectBooking, cancelBooking, deleteBooking, fetchWorkshops } from '../lib/api';

type Booking = {
  id: string;
  slotId: string;
  name: string;
  phone: string;
  messenger: string;
  participants: number;
  comment: string | null;
  status: string;
  createdAt: string;
  slot: { id: string; workshopId: string; date: string; time: string; capacity: number };
};

function useWorkshops() {
  const [workshops, setWorkshops] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    fetchWorkshops()
      .then((list: { id: string; title: string }[]) => setWorkshops(list))
      .catch(() => setWorkshops([]));
  }, []);
  return workshops;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Ожидает',
  PENDING_ADMIN: 'Ожидает (overflow)',
  CONFIRMED: 'Подтверждена',
  CANCELLED: 'Отменена',
  REJECTED: 'Отклонена',
};

export default function Bookings() {
  const workshopsList = useWorkshops();
  const WORKSHOPS: Record<string, string> = Object.fromEntries(workshopsList.map((w) => [w.id, w.title]));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [workshopId, setWorkshopId] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Booking | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (workshopId) params.workshopId = workshopId;
      if (status) params.status = status;
      const data = await fetchBookings(params);
      setBookings(data);
    } catch (e: any) {
      setError(e.message || 'Ошибка загрузки');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [dateFrom, dateTo, workshopId, status]);

  async function handleConfirm(id: string) {
    setError('');
    try {
      await confirmBooking(id);
      load();
      if (detail?.id === id) setDetail(null);
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    }
  }

  async function handleApprove(id: string) {
    setError('');
    try {
      await approveBooking(id);
      load();
      if (detail?.id === id) setDetail(null);
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    }
  }

  async function handleReject(id: string) {
    if (!confirm('Отклонить заявку? Холд будет снят.')) return;
    setError('');
    try {
      await rejectBooking(id);
      load();
      if (detail?.id === id) setDetail(null);
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('Отменить запись? Места вернутся в слот.')) return;
    setError('');
    try {
      await cancelBooking(id);
      load();
      if (detail?.id === id) setDetail(null);
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить запись безвозвратно? Холд (если есть) будет снят.')) return;
    setError('');
    try {
      await deleteBooking(id);
      load();
      if (detail?.id === id) setDetail(null);
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-800">Записи</h1>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={workshopId}
          onChange={(e) => setWorkshopId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Все мастер-классы</option>
          {workshopsList.map(({ id, title }) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Все статусы</option>
          {Object.entries(STATUS_LABEL).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <p className="p-4">Загрузка...</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Дата / время</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Мастер-класс</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Имя</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Телефон</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Статус</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {b.slot.date} {b.slot.time}
                  </td>
                  <td className="px-4 py-3">{WORKSHOPS[b.slot.workshopId] || b.slot.workshopId}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setDetail(b)}
                      className="text-amber-700 hover:underline"
                    >
                      {b.name}
                    </button>
                  </td>
                  <td className="px-4 py-3">{b.phone}</td>
                  <td className="px-4 py-3">{STATUS_LABEL[b.status] || b.status}</td>
                  <td className="px-4 py-3">
                    {b.status === 'PENDING_ADMIN' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleApprove(b.id)}
                          className="mr-2 text-green-700 hover:underline"
                        >
                          Принять
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(b.id)}
                          className="mr-2 text-orange-600 hover:underline"
                        >
                          Отклонить
                        </button>
                      </>
                    )}
                    {b.status === 'PENDING' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleConfirm(b.id)}
                          className="mr-2 text-green-700 hover:underline"
                        >
                          Подтвердить
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancel(b.id)}
                          className="mr-2 text-red-600 hover:underline"
                        >
                          Отменить
                        </button>
                      </>
                    )}
                    {b.status === 'CONFIRMED' && (
                      <button
                        type="button"
                        onClick={() => handleCancel(b.id)}
                        className="mr-2 text-red-600 hover:underline"
                      >
                        Отменить
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(b.id)}
                      className="text-slate-500 hover:text-red-700 hover:underline"
                      title="Удалить запись"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && bookings.length === 0 && (
          <p className="p-4 text-slate-500">Нет записей по выбранным фильтрам.</p>
        )}
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 font-semibold">Детали записи</h3>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Имя</dt>
                <dd>{detail.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Телефон</dt>
                <dd>{detail.phone}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Способ связи</dt>
                <dd>{detail.messenger}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Участников</dt>
                <dd>{detail.participants}</dd>
              </div>
              {detail.comment && (
                <div>
                  <dt className="text-slate-500">Комментарий</dt>
                  <dd>{detail.comment}</dd>
                </div>
              )}
              <div>
                <dt className="text-slate-500">Слот</dt>
                <dd>
                  {detail.slot.date} {detail.slot.time} — {WORKSHOPS[detail.slot.workshopId]}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="mt-4 rounded-lg border px-4 py-2 text-sm"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
