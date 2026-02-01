import { useState, useEffect, useRef } from 'react';
import { fetchGallery, uploadGalleryImage, deleteGalleryImage, fullImageUrl } from '../lib/api';

type GalleryImage = {
  id: string;
  imageUrl: string;
  alt: string | null;
  sortOrder: number;
};

export default function Gallery() {
  const [list, setList] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
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
              {img.alt && <p className="truncate p-2 text-xs text-slate-600">{img.alt}</p>}
              <div className="border-t border-slate-100 p-2">
                <button
                  type="button"
                  onClick={() => handleDelete(img.id)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
