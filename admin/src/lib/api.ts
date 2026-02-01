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
  const res = await fetch(`${API}/admin/slots${q ? `?${q}` : ''}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to load slots');
  return res.json();
}

export async function createSlot(data: { workshopId: string; date: string; time: string; capacity?: number; freeze?: boolean; durationMinutes?: number }) {
  const res = await fetch(`${API}/admin/slots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
  return res.json();
}

export async function updateSlot(id: string, data: { status?: string; capacity?: number; durationMinutes?: number }) {
  const res = await fetch(`${API}/admin/slots/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export async function deleteSlot(id: string) {
  const res = await fetch(`${API}/admin/slots/${id}`, { method: 'DELETE', headers: authHeaders() });
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

export async function updateGalleryImage(id: string, data: { alt?: string | null; sortOrder?: number }) {
  const res = await fetch(`${API}/admin/gallery/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export async function deleteGalleryImage(id: string) {
  const res = await fetch(`${API}/admin/gallery/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!res.ok) throw new Error('Failed');
}

