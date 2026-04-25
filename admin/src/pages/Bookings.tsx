import { useState, useEffect } from 'react';
import { fetchBookings, confirmBooking, approveBooking, rejectBooking, cancelBooking, deleteBooking, fetchWorkshops } from '../lib/api';

type Booking = {
  id: string;
  slotId: string;
  name: string;
  phone: string;
  email: string;
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
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    }
  }

  async function handleApprove(id: string) {
    setError('');
    try {
      await approveBooking(id);
      load();
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
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800 sm:text-2xl">Записи</h1>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-auto"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-auto"
        />
        <select
          value={workshopId}
          onChange={(e) => setWorkshopId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-auto"
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
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-auto"
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
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <p className="p-4">Загрузка...</p>
        ) : (
          <>
          {/* Карточки для мобильных и планшетов */}
          <div className="space-y-3 p-4 md:hidden">
            {bookings.length === 0 ? (
              <p className="text-slate-500">Нет записей по выбранным фильтрам.</p>
            ) : (
              bookings.map((b) => (
              <div
                key={b.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="font-medium text-slate-800">{b.name}</span>
                  <span className="shrink-0 rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                    {STATUS_LABEL[b.status] || b.status}
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  {b.slot.date} {b.slot.time} — {WORKSHOPS[b.slot.workshopId] || b.slot.workshopId}
                </p>
                <p className="text-sm text-slate-500">{b.phone}</p>
                {b.email ? (
                  <p className="text-sm text-slate-500">{b.email}</p>
                ) : null}
                <p className="text-sm text-slate-600">
                  <span className="text-slate-500">Связь:</span> {b.messenger}
                </p>
                <p className="text-sm text-slate-600">
                  <span className="text-slate-500">Участников:</span> {b.participants}
                </p>
                <p className="text-sm text-slate-600">
                  <span className="text-slate-500">Комментарий:</span>{' '}
                  {b.comment?.trim() ? b.comment : '—'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {b.status === 'PENDING_ADMIN' && (
                    <>
                      <button type="button" onClick={() => handleApprove(b.id)} className="text-sm text-green-700 hover:underline">Принять</button>
                      <button type="button" onClick={() => handleReject(b.id)} className="text-sm text-orange-600 hover:underline">Отклонить</button>
                    </>
                  )}
                  {b.status === 'PENDING' && (
                    <>
                      <button type="button" onClick={() => handleConfirm(b.id)} className="text-sm text-green-700 hover:underline">Подтвердить</button>
                      <button type="button" onClick={() => handleCancel(b.id)} className="text-sm text-red-600 hover:underline">Отменить</button>
                    </>
                  )}
                  {b.status === 'CONFIRMED' && (
                    <button type="button" onClick={() => handleCancel(b.id)} className="text-sm text-red-600 hover:underline">Отменить</button>
                  )}
                  <button type="button" onClick={() => handleDelete(b.id)} className="text-sm text-slate-500 hover:text-red-700 hover:underline">Удалить</button>
                </div>
              </div>
            ))
            )}
          </div>

          {/* Таблица для десктопа */}
          <table className="hidden min-w-[56rem] w-full text-sm md:table">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Дата / время</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Мастер-класс</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Имя</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Телефон</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Email</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Связь</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Участников</th>
                <th className="min-w-[10rem] border-b border-slate-200 px-4 py-3 text-left font-medium">Комментарий</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Статус</th>
                <th className="border-b border-slate-200 px-4 py-3 text-left font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3">
                    {b.slot.date} {b.slot.time}
                  </td>
                  <td className="px-4 py-3">{WORKSHOPS[b.slot.workshopId] || b.slot.workshopId}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{b.name}</td>
                  <td className="whitespace-nowrap px-4 py-3">{b.phone}</td>
                  <td className="max-w-[12rem] break-all px-4 py-3 text-slate-600">{b.email || '—'}</td>
                  <td className="px-4 py-3">{b.messenger}</td>
                  <td className="whitespace-nowrap px-4 py-3">{b.participants}</td>
                  <td className="max-w-[14rem] break-words px-4 py-3 text-slate-600">
                    {b.comment?.trim() ? b.comment : '—'}
                  </td>
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
          </>
        )}
        {!loading && bookings.length === 0 && (
          <p className="hidden p-4 text-slate-500 md:block">Нет записей по выбранным фильтрам.</p>
        )}
      </div>
    </div>
  );
}
