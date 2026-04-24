const API = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '') + '/api';

/** Базовый URL API без /api (для картинок /uploads/...) — в dev должен быть полный URL, например http://localhost:3001 */
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '').replace(/\/api\/?$/, '');

/** Полный URL картинки. /uploads/ отдаём как /api/uploads/, чтобы шло через тот же прокси, что и API. */
export function fullImageUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  let p = path.startsWith('/') ? path : '/' + path;
  if (p.startsWith('/uploads/') && !p.startsWith('/api/uploads/')) p = '/api' + p;
  const base = API_BASE.startsWith('http') ? API_BASE : (typeof window !== 'undefined' ? window.location.origin : '') + (API_BASE || '');
  return base + p;
}

function getToken(): string | null {
  return localStorage.getItem('adminToken');
}

/** Ответ не похож на JSON слота (часто index.html из‑за nginx: PATCH не проксируется на Node) */
const ERR_SLOT_NOT_JSON =
  'Сервер вернул не JSON (часто это HTML страницы). Настройте nginx: PATCH к API должен идти на тот же backend, что и GET. Для префикса /gonchar/1 см. DEPLOY.md (location /gonchar/1/api/).';

function parseAdminSlotResponse(res: Response, text: string): Record<string, unknown> {
  let data: unknown;
  try {
    data = text.length ? JSON.parse(text) : null;
  } catch {
    const head = text.slice(0, 120).replace(/\s+/g, ' ').trim();
    if (head.startsWith('<!') || head.toLowerCase().startsWith('<html')) {
      throw new Error(ERR_SLOT_NOT_JSON);
    }
    throw new Error(`Ответ не JSON: ${head.slice(0, 80)}…`);
  }
  if (!res.ok) {
    const o = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const msg =
      typeof o.error === 'string'
        ? o.error
        : typeof o.message === 'string'
          ? o.message
          : `Ошибка ${res.status}`;
    throw new Error(msg);
  }
  if (data === null || typeof data !== 'object' || typeof (data as Record<string, unknown>).id !== 'string') {
    throw new Error(ERR_SLOT_NOT_JSON);
  }
  return data as Record<string, unknown>;
}

export async function login(login: string, password: string): Promise<{ token: string; login: string }> {
  const res = await fetch(`${API}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Login failed');
  }
  return res.json();
}

export async function getMe(): Promise<{ login: string }> {
  const token = getToken();
  if (!token) throw new Error('No token');
  const res = await fetch(`${API}/admin/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Unauthorized');
  return res.json();
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function uploadImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${API}/admin/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Upload failed');
  return res.json();
}

export async function fetchWorkshops() {
  const res = await fetch(`${API}/admin/workshops`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load workshops');
  return res.json();
}

export async function createWorkshop(data: {
  title: string;
  description?: string;
  durationMinutes: number;
  capacityPerSlot: number;
  result?: string;
  price: number;
  imageUrl?: string | null;
  isActive?: boolean;
}) {
  const res = await fetch(`${API}/admin/workshops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
  return res.json();
}

export async function updateWorkshop(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    durationMinutes: number;
    capacityPerSlot: number;
    result: string;
    price: number;
    imageUrl: string | null;
    isActive: boolean;
  }>
) {
  const res = await fetch(`${API}/admin/workshops/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export async function deleteWorkshop(id: string) {
  const res = await fetch(`${API}/admin/workshops/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error('Failed');
}

export async function fetchSlots(params?: { workshopId?: string; dateFrom?: string; dateTo?: string }) {
  const q = new URLSearchParams(params as Record<string, string>).toString();
  const res = await fetch(`${API}/admin/slots${q ? `?${q}` : ''}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text.length ? JSON.parse(text) : null;
  } catch {
    throw new Error('Не удалось разобрать ответ при загрузке слотов. Проверьте VITE_API_BASE и прокси /api.');
  }
  if (!res.ok) {
    const o = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const msg = typeof o.error === 'string' ? o.error : `Ошибка ${res.status}`;
    throw new Error(msg);
  }
  if (!Array.isArray(data)) {
    throw new Error(
      'Список слотов: неверный формат (ожидался JSON-массив). GET /api не попадает в backend — см. DEPLOY.md.'
    );
  }
  return data;
}

export async function createSlot(data: {
  workshopId: string;
  date: string;
  time: string;
  capacity?: number;
  freeze?: boolean;
  durationMinutes?: number;
  offlineOccupiedSeats?: number;
}) {
  const res = await fetch(`${API}/admin/slots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  return parseAdminSlotResponse(res, text);
}

export async function updateSlot(id: string, data: {
  status?: string;
  capacity?: number;
  offlineOccupiedSeats?: number;
  manualOccupiedSeats?: number | null;
  durationMinutes?: number;
  workshopId?: string;
}) {
  const safeId = encodeURIComponent(id);
  const res = await fetch(`${API}/admin/slots/${safeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  return parseAdminSlotResponse(res, text);
}

export async function deleteSlot(id: string) {
  const res = await fetch(`${API}/admin/slots/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error('Failed');
}

export async function fetchBookings(params?: { dateFrom?: string; dateTo?: string; workshopId?: string; status?: string }) {
  const q = new URLSearchParams(params as Record<string, string>).toString();
  const res = await fetch(`${API}/admin/bookings${q ? `?${q}` : ''}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load bookings');
  return res.json();
}

export async function confirmBooking(id: string) {
  const res = await fetch(`${API}/admin/bookings/${id}/confirm`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export async function approveBooking(id: string) {
  const res = await fetch(`${API}/admin/bookings/${id}/approve`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export async function rejectBooking(id: string) {
  const res = await fetch(`${API}/admin/bookings/${id}/reject`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export async function cancelBooking(id: string) {
  const res = await fetch(`${API}/admin/bookings/${id}/cancel`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export async function deleteBooking(id: string) {
  const res = await fetch(`${API}/admin/bookings/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error('Failed');
}

// --- New workshop requests ---
export async function fetchWorkshopRequests() {
  const res = await fetch(`${API}/admin/workshop-requests`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load workshop requests');
  return res.json();
}

export async function updateWorkshopRequest(
  id: string,
  data: Partial<{
    workshopId: string;
    date: string;
    time: string;
    name: string;
    phone: string;
    messenger: string;
    participants: number;
    comment: string | null;
  }>
) {
  const res = await fetch(`${API}/admin/workshop-requests/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed');
  return body;
}

export async function deleteWorkshopRequest(id: string) {
  const res = await fetch(`${API}/admin/workshop-requests/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
}

export async function confirmWorkshopRequest(id: string) {
  const res = await fetch(`${API}/admin/workshop-requests/${id}/confirm`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Failed');
  return body;
}

// --- Reviews ---
export async function fetchReviews() {
  const res = await fetch(`${API}/admin/reviews`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load reviews');
  return res.json();
}

export async function createReview(data: { name: string; text: string; rating?: number; date?: string }) {
  const res = await fetch(`${API}/admin/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
  return res.json();
}

export async function updateReview(id: string, data: Partial<{ name: string; text: string; rating: number; date: string }>) {
  const res = await fetch(`${API}/admin/reviews/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export async function deleteReview(id: string) {
  const res = await fetch(`${API}/admin/reviews/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error('Failed');
}

// --- Gallery ---
export async function fetchGallery() {
  const res = await fetch(`${API}/admin/gallery`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load gallery');
  return res.json();
}

export async function uploadGalleryImage(file: File, alt?: string) {
  const formData = new FormData();
  formData.append('image', file);
  if (alt != null) formData.append('alt', alt);
  const res = await fetch(`${API}/admin/gallery`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Upload failed');
  return res.json();
}

export async function updateGalleryImage(id: string, data: { alt?: string | null; comment?: string | null; sortOrder?: number }) {
  const res = await fetch(`${API}/admin/gallery/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Ошибка ${res.status}`);
  }
  return res.json();
}

export async function deleteGalleryImage(id: string) {
  const res = await fetch(`${API}/admin/gallery/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error('Failed');
}

// --- Контакты (блоки на сайте) ---
export type ContactBlockDto = {
  id?: string;
  sortOrder?: number;
  blockType: 'FIELD' | 'BUTTON';
  label: string;
  value: string | null;
  href: string | null;
  variant: 'primary' | 'secondary' | null;
  iconKey: string;
  /** Только при iconKey === 'custom' — URL из загрузки (/api/uploads/...) */
  customIconUrl?: string | null;
};

export async function fetchContacts(): Promise<{ blocks: ContactBlockDto[] }> {
  const res = await fetch(`${API}/admin/contacts`, { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error('Не удалось загрузить контакты');
  return res.json();
}

export async function saveContacts(blocks: Omit<ContactBlockDto, 'id' | 'sortOrder'>[]): Promise<{ blocks: ContactBlockDto[] }> {
  const res = await fetch(`${API}/admin/contacts`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ blocks }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || 'Ошибка сохранения');
  return body;
}
