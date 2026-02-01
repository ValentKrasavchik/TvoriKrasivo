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
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
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
                  <button
                    type="button"
                    onClick={() => setDetail(b)}
                    className="font-medium text-amber-700 hover:underline"
                  >
                    {b.name}
                  </button>
                  <span className="shrink-0 rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                    {STATUS_LABEL[b.status] || b.status}
                  </span>
                </div>
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <button
                    type="button"
                    onClick={() => setDetail(b)}
                    className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                    title="Открыть детали записи"
                    aria-label="Открыть детали записи"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                  <span>{b.slot.date} {b.slot.time} — {WORKSHOPS[b.slot.workshopId] || b.slot.workshopId}</span>
                </p>
                <p className="text-sm text-slate-500">{b.phone}</p>
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
          <table className="hidden w-full text-sm md:table">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-10 border-b border-slate-200 px-2 py-3 text-left font-medium" aria-label="Просмотр" />
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
                  <td className="w-10 px-2 py-3">
                    <button
                      type="button"
                      onClick={() => setDetail(b)}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                      title="Открыть детали записи"
                      aria-label="Открыть детали записи"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  </td>
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
          </>
        )}
        {!loading && bookings.length === 0 && (
          <p className="hidden p-4 text-slate-500 md:block">Нет записей по выбранным фильтрам.</p>
        )}
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-6"
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
              <div>
                <dt className="text-slate-500">Комментарий</dt>
                <dd>{detail.comment?.trim() ? detail.comment : '—'}</dd>
              </div>
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
