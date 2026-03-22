import { useState, useEffect, useRef } from 'react';
import { fetchGallery, uploadGalleryImage, updateGalleryImage, deleteGalleryImage, fullImageUrl } from '../lib/api';

type GalleryImage = {
  id: string;
  imageUrl: string;
  alt: string | null;
  comment: string | null;
  sortOrder: number;
};

export default function Gallery() {
  const [list, setList] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAlt, setEditAlt] = useState('');
  const [editComment, setEditComment] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await fetchGallery();
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
      await uploadGalleryImage(file);
      load();
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить изображение из галереи?')) return;
    setError('');
    try {
      await deleteGalleryImage(id);
      load();
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    }
  }

  function startEdit(img: GalleryImage) {
    setEditingId(img.id);
    setEditAlt(img.alt ?? '');
    setEditComment(img.comment ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditAlt('');
    setEditComment('');
  }

  async function saveEdit(id: string, currentAlt: string, currentComment: string) {
    setError('');
    try {
      await updateGalleryImage(id, { alt: currentAlt || null, comment: currentComment || null });
      setEditingId(null);
      setEditAlt('');
      setEditComment('');
      await load();
    } catch (e: any) {
      setError(e.message || 'Ошибка сохранения');
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800 sm:text-2xl">Галерея работ</h1>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
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
          className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-50 sm:w-auto"
        >
          {uploading ? 'Загрузка...' : '➕ Добавить изображение'}
        </button>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="p-4">Загрузка...</p>
      ) : list.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Нет изображений. Добавьте первое.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
          {list.map((img) => (
            <div
              key={img.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="aspect-square bg-slate-100">
                <img
                  src={fullImageUrl(img.imageUrl)}
                  alt={img.alt || ''}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>';
                  }}
                />
              </div>
              {editingId === img.id ? (
                <div className="border-t border-slate-100 p-2 space-y-2">
                  <label className="block text-xs text-slate-500">Подпись (alt)</label>
                  <input
                    type="text"
                    value={editAlt}
                    onChange={(e) => setEditAlt(e.target.value)}
                    className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                    placeholder="Подпись"
                  />
                  <label className="block text-xs text-slate-500">Комментарий</label>
                  <textarea
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                    className="w-full rounded border border-slate-200 px-2 py-1 text-sm min-h-[60px]"
                    placeholder="Комментарий к работе"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(img.id, editAlt, editComment)}
                      className="rounded bg-amber-600 px-2 py-1 text-xs text-white hover:bg-amber-700"
                    >
                      Сохранить
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {(img.alt || img.comment) && (
                    <div className="p-2 text-xs text-slate-600 space-y-0.5">
                      {img.alt && <p className="truncate">{img.alt}</p>}
                      {img.comment && <p className="text-slate-500 line-clamp-2">{img.comment}</p>}
                    </div>
                  )}
                  <div className="border-t border-slate-100 p-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(img)}
                      className="text-xs text-amber-600 hover:underline"
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(img.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Удалить
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
