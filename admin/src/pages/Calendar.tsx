import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ruLocale from '@fullcalendar/core/locales/ru';
import { fetchSlots, createSlot, updateSlot, deleteSlot, fetchWorkshops } from '../lib/api';

type Slot = {
  id: string;
  workshopId: string;
  date: string;
  time: string;
  capacity: number;
  durationMinutes?: number | null;
  capacityTotal?: number;
  freeSeats?: number;
  bookedSeats?: number;
  heldSeats?: number;
  status: string;
  workshop?: { id?: string; durationMinutes?: number };
};

function slotWorkshopId(s: Slot): string {
  return (s.workshopId || s.workshop?.id || '').trim();
}

function getInitialWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  const from = mon.toISOString().slice(0, 10);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  return { dateFrom: from, dateTo: sun.toISOString().slice(0, 10) };
}

type WorkshopOption = { id: string; label: string; durationMinutes: number };

function toDateTimeLocalValue(date: string, time: string) {
  if (!date) return '';
  const safeTime = time && time.length >= 5 ? time.slice(0, 5) : '12:00';
  return `${date}T${safeTime}`;
}

function fromDateTimeLocalValue(value: string) {
  if (!value) return { date: '', time: '' };
  const [datePart, timePart = '12:00'] = value.split('T');
  return {
    date: datePart || '',
    time: (timePart || '12:00').slice(0, 5),
  };
}

function slotToEvent(s: Slot) {
  const free = s.freeSeats ?? s.capacity ?? 0;
  const cap = s.capacityTotal ?? s.capacity ?? 0;
  const start = new Date(`${s.date}T${s.time}:00`);
  const end = new Date(start);
  const duration = s.durationMinutes ?? s.workshop?.durationMinutes ?? 120;
  end.setMinutes(end.getMinutes() + duration);
  return {
    id: s.id,
    title: `${s.time} — ${s.status} — Своб: ${free}/${cap}`,
    start,
    end,
    extendedProps: { slot: s },
    backgroundColor:
      s.status === 'HELD' ? '#94a3b8' : s.status === 'CANCELLED' ? '#f87171' : (s.freeSeats ?? 0) === 0 ? '#fcd34d' : '#34d399',
  };
}

function slotsToEvents(slots: Slot[]) {
  return slots.map(slotToEvent);
}

export default function Calendar() {
  const initialWeek = getInitialWeek();
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [workshopId, setWorkshopId] = useState('');
  const [dateFrom, setDateFrom] = useState(initialWeek.dateFrom);
  const [dateTo, setDateTo] = useState(initialWeek.dateTo);
  const [modal, setModal] = useState<{
    type: 'create' | 'edit';
    slot?: Slot;
    /** id слота из API — не полагаться только на объект из FullCalendar */
    slotId?: string;
    date?: string;
    time?: string;
    createDateRange?: { dateFrom: string; dateTo: string };
  } | null>(null);
  const [form, setForm] = useState({ workshopId: '', date: '', time: '12:00', capacity: 6, freeze: false, durationMinutes: 120 });
  const [slotsOverviewOpen, setSlotsOverviewOpen] = useState(false);
  const [overviewCountByDay, setOverviewCountByDay] = useState<Record<string, number>>({});
  const [overviewMonthYear, setOverviewMonthYear] = useState<{ year: number; month: number } | null>(null);
  const [dateTimeLocal, setDateTimeLocal] = useState('');
  const [createScope, setCreateScope] = useState<'single' | 'week' | 'month'>('single');
  const [createProgress, setCreateProgress] = useState<string | null>(null);
  const calendarRef = useRef<FullCalendar>(null);
  /** Синхронное значение выбранного мастер-класса в модалке (state может отставать от submit) */
  const modalWorkshopIdRef = useRef<string>('');
  const workshopIdRef = useRef(workshopId);
  workshopIdRef.current = workshopId;

  useEffect(() => {
    fetchWorkshops()
      .then((list: { id: string; title: string; durationMinutes?: number }[]) => {
        setWorkshops(
          list.map((w) => ({
            id: w.id,
            label: w.title,
            durationMinutes: w.durationMinutes ?? 120,
          }))
        );
        if (list.length) setWorkshopId((prev) => prev || list[0].id);
      })
      .catch(() => setWorkshops([]));
  }, []);

  useEffect(() => {
    if (workshops.length && !workshopId) setWorkshopId(workshops[0].id);
  }, [workshops, workshopId]);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const getWorkshopDuration = (id: string) => {
    const w = workshops.find((item) => item.id === id);
    return w?.durationMinutes ?? 120;
  };

  const refetchEvents = () => {
    calendarRef.current?.getApi()?.refetchEvents();
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (workshopId) refetchEvents();
    }, 10_000);
    return () => clearInterval(intervalId);
  }, [workshopId]);

  function openCreateFromDate(arg: { dateStr: string; date?: Date }) {
    const dateStr = arg.dateStr.slice(0, 10);
    let time = '12:00';
    if (arg.dateStr.includes('T') && arg.date) {
      time = `${String(arg.date.getHours()).padStart(2, '0')}:${String(arg.date.getMinutes()).padStart(2, '0')}`;
    }
    const duration = getWorkshopDuration(workshopId);
    modalWorkshopIdRef.current = workshopId;
    setForm({ workshopId, date: dateStr, time, capacity: 6, freeze: false, durationMinutes: duration });
    setDateTimeLocal(toDateTimeLocalValue(dateStr, time));
    setModal({ type: 'create', date: dateStr });
    setCreateScope('single');
    setCreateProgress(null);
    setError('');
  }

  function openCreateFromButton() {
    const api = calendarRef.current?.getApi();
    const base = api?.getDate() ?? new Date();
    const dateStr = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
    const time = '12:00';
    const duration = getWorkshopDuration(workshopId);
    modalWorkshopIdRef.current = workshopId;
    setForm({ workshopId, date: dateStr, time, capacity: 6, freeze: false, durationMinutes: duration });
    setDateTimeLocal(toDateTimeLocalValue(dateStr, time));
    setModal({ type: 'create', date: dateStr });
    setCreateScope('single');
    setCreateProgress(null);
    setError('');
  }

  function openCreateFromSelect(selectInfo: { start: Date; end: Date; allDay?: boolean; startStr?: string; endStr?: string; view: { type?: string; calendar: { unselect: () => void } } }) {
    const start = selectInfo.start;
    const viewType = selectInfo.view?.type;
    const isDayView = viewType === 'timeGridDay';
    const isAllDay = !isDayView && Boolean(selectInfo.allDay);
    const dateStr =
      (selectInfo.startStr && selectInfo.startStr.slice(0, 10).match(/^\d{4}-\d{2}-\d{2}$/))
        ? selectInfo.startStr.slice(0, 10)
        : `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const time = isAllDay
      ? '00:00'
      : `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
    const diffMinutes = Math.max(1, Math.round((selectInfo.end.getTime() - selectInfo.start.getTime()) / 60000));
    modalWorkshopIdRef.current = workshopId;
    setForm({ workshopId, date: dateStr, time, capacity: 6, freeze: true, durationMinutes: diffMinutes });
    setDateTimeLocal(toDateTimeLocalValue(dateStr, time));

    let createDateRange: { dateFrom: string; dateTo: string } | undefined;
    if (isAllDay && selectInfo.startStr && selectInfo.endStr) {
      const dateFrom = selectInfo.startStr.slice(0, 10);
      const endExclusive = selectInfo.endStr.slice(0, 10);
      const endDate = new Date(endExclusive + 'T12:00:00');
      endDate.setDate(endDate.getDate() - 1);
      const dateTo = endDate.toISOString().slice(0, 10);
      if (dateTo >= dateFrom && dateFrom !== dateTo) {
        createDateRange = { dateFrom, dateTo };
      }
    }

    setModal({ type: 'create', date: dateStr, createDateRange });
    setError('');
    selectInfo.view?.calendar?.unselect?.();
  }

  function openEdit(slot: Slot) {
    const sw = slotWorkshopId(slot);
    modalWorkshopIdRef.current = sw;
    setForm({
      workshopId: sw,
      date: slot.date,
      time: slot.time,
      capacity: slot.capacity,
      freeze: slot.status === 'HELD',
      durationMinutes: slot.durationMinutes ?? slot.workshop?.durationMinutes ?? 120,
    });
    setDateTimeLocal(toDateTimeLocalValue(slot.date, slot.time));
    setModal({ type: 'edit', slot, slotId: String(slot.id) });
    setError('');
  }

  function getDatesInRange(dateFrom: string, dateTo: string): string[] {
    const out: string[] = [];
    const from = new Date(dateFrom + 'T12:00:00');
    const to = new Date(dateTo + 'T12:00:00');
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }

  async function handleCreate() {
    setError('');
    const wid =
      (modalWorkshopIdRef.current || '').trim() || form.workshopId || workshopId;
    if (!wid) {
      setError('Укажите мастер-класс');
      return;
    }
    if (!form.date || !form.time) {
      setError('Укажите дату и время');
      return;
    }
    setCreating(true);
    setCreateProgress(null);
    try {
      const payload = {
        ...form,
        workshopId: wid,
        durationMinutes: form.durationMinutes,
        capacity: form.capacity,
      };
      const range = modal?.createDateRange;
      const api = calendarRef.current?.getApi();
      const scope = createScope;

      if (scope === 'week' || scope === 'month') {
        const days = scope === 'week' ? 7 : 30;
        const startDate = new Date((form.date || '').slice(0, 10) + 'T12:00:00');
        if (isNaN(startDate.getTime())) {
          setError('Укажите дату');
          setCreating(false);
          return;
        }
        const duration = getWorkshopDuration(wid);
        const time = form.time && form.time.length >= 5 ? form.time.slice(0, 5) : '12:00';
        for (let i = 0; i < days; i++) {
          const d = new Date(startDate);
          d.setDate(startDate.getDate() + i);
          const dateStr = d.toISOString().slice(0, 10);
          setCreateProgress(`${i + 1} / ${days}`);
          await createSlot({
            workshopId: wid,
            date: dateStr,
            time,
            capacity: payload.capacity,
            freeze: false,
            durationMinutes: duration,
          });
        }
        setCreateProgress(null);
        setModal(null);
        refetchEvents();
        setCreating(false);
        return;
      }

      if (range) {
        const dates = getDatesInRange(range.dateFrom, range.dateTo);
        if (dates.length > 0) {
          const duration = getWorkshopDuration(wid);
          for (const date of dates) {
            const created = await createSlot({
              workshopId: wid,
              date,
              time: '00:00',
              capacity: payload.capacity,
              freeze: true,
              durationMinutes: Math.max(1, payload.durationMinutes || duration),
            });
            if (api && created) api.addEvent(slotToEvent(created as Slot));
          }
        } else {
          const created = await createSlot(payload);
          if (api && created) api.addEvent(slotToEvent(created as Slot));
        }
      } else {
        const created = await createSlot(payload);
        if (api && created) api.addEvent(slotToEvent(created as Slot));
      }
      setModal(null);
      refetchEvents();
    } catch (e: any) {
      setError(e?.message || String(e) || 'Ошибка создания');
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate() {
    if (!modal?.slot) return;
    const slotId = modal.slotId || String(modal.slot.id);
    if (!slotId) {
      setError('Не удалось определить id слота. Закройте окно и откройте слот снова.');
      return;
    }
    setError('');
    const slotWid = slotWorkshopId(modal.slot);
    const chosen =
      (modalWorkshopIdRef.current || '').trim() || (form.workshopId || '').trim();
    const wid = (chosen || slotWid).trim();
    if (!wid) {
      setError('Укажите мастер-класс');
      return;
    }
    try {
      await updateSlot(slotId, {
        workshopId: wid,
        capacity: form.capacity,
        status: form.freeze ? 'HELD' : 'OPEN',
        durationMinutes: form.durationMinutes,
      });
      if (chosen && chosen !== slotWid) {
        workshopIdRef.current = chosen;
        setWorkshopId(chosen);
      }
      setModal(null);
      refetchEvents();
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить слот?')) return;
    try {
      await deleteSlot(id);
      setModal(null);
      refetchEvents();
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    }
  }

  async function openSlotsOverview() {
    const api = calendarRef.current?.getApi();
    const wid = workshopIdRef.current;
    if (!api || !wid) return;
    const d = api.getDate();
    const year = d.getFullYear();
    const month = d.getMonth();
    const dateFrom = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const dateTo = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    setOverviewMonthYear({ year, month });
    try {
      const slots = await fetchSlots({ workshopId: wid, dateFrom, dateTo });
      const byDay: Record<string, number> = {};
      for (const s of slots as Slot[]) {
        const free = s.freeSeats ?? 0;
        const open = (s.status || '') === 'OPEN';
        if (s.date && open && free > 0) {
          byDay[s.date] = (byDay[s.date] ?? 0) + 1;
        }
      }
      setOverviewCountByDay(byDay);
      setSlotsOverviewOpen(true);
    } catch {
      setOverviewCountByDay({});
      setSlotsOverviewOpen(true);
    }
  }

  function buildMonthGrid(year: number, month: number) {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDow = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const daysInMonth = last.getDate();
    const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;
    const grid: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) grid.push(d);
    while (grid.length < totalCells) grid.push(null);
    return { grid, daysInMonth };
  }

  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const weekdayShort = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800 sm:text-2xl">Календарь слотов</h1>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        <button
          type="button"
          onClick={openCreateFromButton}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 sm:w-auto"
        >
          Добавить
        </button>
        <select
          value={workshopId}
          onChange={(e) => {
            setWorkshopId(e.target.value);
            setTimeout(refetchEvents, 0);
          }}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-auto"
        >
          <option value="">{workshops.length ? 'Мастер-класс' : 'Загрузка...'}</option>
          {workshops.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500 sm:text-sm">
          Период: {dateFrom} … {dateTo} (неделя/месяц — переключайте в календаре)
        </span>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 sm:p-4 [&_.fc]:min-w-[320px]">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale={ruLocale}
          height={650}
          events={async (fetchInfo, successCallback) => {
            const wid = workshopIdRef.current;
            if (!wid) {
              successCallback([]);
              return;
            }
            const dateFromStr = fetchInfo.startStr.slice(0, 10);
            const endDate = new Date(fetchInfo.end);
            endDate.setDate(endDate.getDate() - 1);
            const dateToStr = endDate.toISOString().slice(0, 10);
            setDateFrom(dateFromStr);
            setDateTo(dateToStr);
            try {
              const data = await fetchSlots({ workshopId: wid, dateFrom: dateFromStr, dateTo: dateToStr });
              successCallback(slotsToEvents(data));
            } catch {
              successCallback([]);
            }
          }}
          selectable
          select={openCreateFromSelect}
          dateClick={openCreateFromDate}
          eventClick={({ event }) => {
            const slot = event.extendedProps?.slot as Slot;
            if (slot) openEdit(slot);
          }}
          headerToolbar={{ left: 'prev,next', center: 'title', right: 'today dayGridMonth,timeGridWeek,timeGridDay calendarOverview' }}
          customButtons={{
            calendarOverview: {
              text: '📅',
              hint: 'Обзор слотов по дням месяца',
              click: openSlotsOverview,
            },
          }}
          buttonText={{ month: 'Месяц', week: 'Неделя', day: 'День' }}
          slotMinTime="09:00:00"
          slotMaxTime="23:00:00"
          slotDuration="00:30:00"
          views={{
            dayGridMonth: { titleFormat: { month: 'long', year: 'numeric' } },
            timeGridWeek: { slotMinTime: '09:00:00', slotMaxTime: '23:00:00' },
            timeGridDay: { slotMinTime: '09:00:00', slotMaxTime: '23:00:00' },
          }}
        />
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 sm:p-6"
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-6">
            <h2 className="mb-4 font-semibold">
              {modal.type === 'create' && modal.createDateRange
                ? `Заморозить период (HELD)`
                : modal.type === 'create'
                  ? 'Новый слот'
                  : 'Редактировать слот'}
            </h2>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (creating) return;
                if (modal?.type === 'create') handleCreate();
                else if (modal?.type === 'edit') handleUpdate();
              }}
              noValidate
            >
              <div>
                <label className="block text-sm text-slate-600">Мастер-класс</label>
                <select
                  value={
                    modal.type === 'edit' && modal.slot
                      ? form.workshopId || slotWorkshopId(modal.slot)
                      : form.workshopId || workshopId
                  }
                  onChange={(e) => {
                    const nextId = e.target.value;
                    modalWorkshopIdRef.current = nextId;
                    const nextDuration = getWorkshopDuration(nextId);
                    setForm((f) => ({ ...f, workshopId: nextId, durationMinutes: nextDuration }));
                  }}
                  className="mt-1 w-full rounded border px-3 py-2"
                >
                  <option value="">Выберите мастер-класс</option>
                  {workshops.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
              {modal.type === 'create' && !modal.createDateRange && (
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Период</label>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setCreateScope('single')}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium ${createScope === 'single' ? 'border-amber-600 bg-amber-50 text-amber-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                    >
                      Один слот
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateScope('week')}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium ${createScope === 'week' ? 'border-amber-600 bg-amber-50 text-amber-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                    >
                      На неделю
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreateScope('month')}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium ${createScope === 'month' ? 'border-amber-600 bg-amber-50 text-amber-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                    >
                      На месяц
                    </button>
                  </div>
                  {createScope === 'week' && <p className="mt-1 text-xs text-slate-500">Будет создано 7 слотов (по одному в день с выбранной даты)</p>}
                  {createScope === 'month' && <p className="mt-1 text-xs text-slate-500">Будет создано 30 слотов (по одному в день с выбранной даты)</p>}
                </div>
              )}
              {modal.createDateRange ? (
                <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  С {modal.createDateRange.dateFrom} по {modal.createDateRange.dateTo} — будет создано{' '}
                  {getDatesInRange(modal.createDateRange.dateFrom, modal.createDateRange.dateTo).length} слотов (HELD, 00:00).
                </div>
              ) : (
                <div>
                  <label className="block text-sm text-slate-600">Дата и время</label>
                  <input
                    type="datetime-local"
                    step={300}
                    value={dateTimeLocal}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDateTimeLocal(next);
                      const parsed = fromDateTimeLocalValue(next);
                      setForm((f) => ({ ...f, date: parsed.date, time: parsed.time }));
                    }}
                    className="mt-1 w-full rounded border px-3 py-2"
                    disabled={modal.type === 'edit'}
                  />
                </div>
              )}
              {!modal.createDateRange && (
                <>
                  <div>
                    <label className="block text-sm text-slate-600">Вместимость</label>
                    <input
                      type="number"
                      min={1}
                      value={form.capacity}
                      onChange={(e) => setForm((f) => ({ ...f, capacity: parseInt(e.target.value, 10) || 1 }))}
                      className="mt-1 w-full rounded border px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600">Длительность (мин)</label>
                    <input
                      type="number"
                      min={1}
                      value={form.durationMinutes}
                      onChange={(e) => setForm((f) => ({ ...f, durationMinutes: parseInt(e.target.value, 10) || 1 }))}
                      className="mt-1 w-full rounded border px-3 py-2"
                    />
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.freeze}
                      onChange={(e) => setForm((f) => ({ ...f, freeze: e.target.checked }))}
                      className="h-4 w-4"
                    />
                    Заморозить это время (HELD)
                  </label>
                </>
              )}
              {modal.type === 'edit' && modal.slot && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(modal.slotId || String(modal.slot!.id))}
                    className="rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200"
                  >
                    Удалить
                  </button>
                </div>
              )}
              {error && <p className="mt-2 rounded bg-red-50 px-2 py-1.5 text-sm text-red-700" role="alert">{error}</p>}
              <div className="mt-4 flex gap-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating
                    ? (createProgress ? `Создание… ${createProgress}` : 'Создание…')
                    : modal.type === 'create' && modal.createDateRange
                      ? `Заморозить ${getDatesInRange(modal.createDateRange.dateFrom, modal.createDateRange.dateTo).length} дней`
                      : modal.type === 'create'
                        ? createScope === 'week'
                          ? 'Создать 7 слотов'
                          : createScope === 'month'
                            ? 'Создать 30 слотов'
                            : 'Создать'
                        : 'Сохранить'}
                </button>
                <button type="button" onClick={() => setModal(null)} className="rounded-lg border px-4 py-2">
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {slotsOverviewOpen &&
        overviewMonthYear &&
        createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center bg-black/50 p-4"
            style={{ zIndex: 99999 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSlotsOverviewOpen(false);
            }}
          >
            <div
              className="relative z-10 w-full max-w-[420px] rounded-xl bg-white shadow-xl overflow-hidden"
              style={{ pointerEvents: 'auto' }}
              onClick={(e) => e.stopPropagation()}
              data-slots-overview-modal
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-800 m-0">Слоты по дням</h2>
                <button
                  type="button"
                  onClick={() => setSlotsOverviewOpen(false)}
                  className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Закрыть"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="p-5">
                <p className="mb-4 text-center text-lg font-semibold text-slate-800">
                  {monthNames[overviewMonthYear.month]} {overviewMonthYear.year}
                </p>
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  {weekdayShort.map((w) => (
                    <span key={w}>{w}</span>
                  ))}
                </div>
                <div
                  className="grid grid-cols-7 gap-1"
                  style={{ pointerEvents: 'auto' }}
                  onClick={(e) => {
                    const el = (e.target as HTMLElement).closest('[data-slot-date]');
                    if (!el) return;
                    const dateStr = el.getAttribute('data-slot-date');
                    if (!dateStr) return;
                    setSlotsOverviewOpen(false);
                    calendarRef.current?.getApi().gotoDate(dateStr);
                  }}
                >
                  {buildMonthGrid(overviewMonthYear.year, overviewMonthYear.month).grid.map((day, i) => {
                    if (day === null) return <div key={i} className="aspect-square min-h-0" />;
                    const dateStr = `${overviewMonthYear.year}-${String(overviewMonthYear.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const count = overviewCountByDay[dateStr] ?? 0;
                    return (
                      <div
                        key={i}
                        role="button"
                        tabIndex={0}
                        data-slot-date={dateStr}
                        className="flex aspect-square min-h-[36px] cursor-pointer select-none flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50/50 text-[13px] font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        title={`Перейти к ${dateStr}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSlotsOverviewOpen(false);
                            calendarRef.current?.getApi().gotoDate(dateStr);
                          }
                        }}
                      >
                        <span>{day}</span>
                        {count > 0 && (
                          <span className="mt-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-emerald-500 px-1 text-[11px] font-bold text-white">
                            {count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-5 text-center text-xs text-slate-500">Число в кружке — количество слотов с местами в этот день</p>
                <button
                  type="button"
                  onClick={() => setSlotsOverviewOpen(false)}
                  className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
