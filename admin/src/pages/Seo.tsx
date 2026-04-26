import { useState, useEffect } from 'react';
import { fetchSeo, saveSeo, type SiteSeoPayload } from '../lib/api';

type SeoForm = {
  metaTitle: string;
  metaDescription: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  canonicalUrl: string;
};

const empty: SeoForm = {
  metaTitle: '',
  metaDescription: '',
  ogTitle: '',
  ogDescription: '',
  ogImage: '',
  canonicalUrl: '',
};

export default function Seo() {
  const [form, setForm] = useState<SeoForm>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedOk, setSavedOk] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    setSavedOk(false);
    try {
      const data = await fetchSeo();
      setForm({
        metaTitle: data.metaTitle ?? '',
        metaDescription: data.metaDescription ?? '',
        ogTitle: data.ogTitle ?? '',
        ogDescription: data.ogDescription ?? '',
        ogImage: data.ogImage ?? '',
        canonicalUrl: data.canonicalUrl ?? '',
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function patch<K extends keyof SeoForm>(key: K, value: SeoForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSavedOk(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    setSavedOk(false);
    try {
      const data: SiteSeoPayload = await saveSeo({
        metaTitle: form.metaTitle.trim(),
        metaDescription: form.metaDescription.trim(),
        ogTitle: form.ogTitle.trim(),
        ogDescription: form.ogDescription.trim(),
        ogImage: form.ogImage.trim() || null,
        canonicalUrl: form.canonicalUrl.trim() || null,
      });
      setForm({
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        ogTitle: data.ogTitle,
        ogDescription: data.ogDescription,
        ogImage: data.ogImage ?? '',
        canonicalUrl: data.canonicalUrl ?? '',
      });
      setSavedOk(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800 sm:text-2xl">SEO главной страницы</h1>
      <p className="mb-4 max-w-2xl text-sm text-slate-600">
        Эти поля подставляются на публичный сайт в тег <code className="rounded bg-slate-100 px-1">&lt;title&gt;</code>,{' '}
        <code className="rounded bg-slate-100 px-1">meta description</code> и Open Graph (превью в соцсетях и мессенджерах).
        После сохранения гости увидят обновления при следующей загрузке страницы.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {savedOk && <p className="mb-3 text-sm text-green-700">Сохранено.</p>}

      {loading ? (
        <p className="p-4">Загрузка...</p>
      ) : (
        <form onSubmit={handleSave} className="max-w-2xl space-y-4">
          <label className="block text-sm">
            <span className="text-slate-600">Заголовок страницы (title)</span>
            <input
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              value={form.metaTitle}
              onChange={(e) => patch('metaTitle', e.target.value)}
              maxLength={200}
              required
            />
            <span className="mt-0.5 block text-xs text-slate-400">{form.metaTitle.length} / 200</span>
          </label>

          <label className="block text-sm">
            <span className="text-slate-600">Meta description</span>
            <textarea
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              rows={4}
              value={form.metaDescription}
              onChange={(e) => patch('metaDescription', e.target.value)}
              maxLength={500}
              required
            />
            <span className="mt-0.5 block text-xs text-slate-400">{form.metaDescription.length} / 500</span>
          </label>

          <div className="border-t border-slate-200 pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Open Graph</p>
          </div>

          <label className="block text-sm">
            <span className="text-slate-600">OG — заголовок (og:title)</span>
            <input
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              value={form.ogTitle}
              onChange={(e) => patch('ogTitle', e.target.value)}
              maxLength={200}
              required
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-600">OG — описание (og:description)</span>
            <textarea
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              rows={3}
              value={form.ogDescription}
              onChange={(e) => patch('ogDescription', e.target.value)}
              maxLength={500}
              required
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-600">OG — изображение (путь или URL)</span>
            <input
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              value={form.ogImage}
              onChange={(e) => patch('ogImage', e.target.value)}
              maxLength={500}
              placeholder="images/hero.jpg или https://…"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Относительный путь — от корня сайта; для превью в соцсетях лучше абсолютный https-URL.
            </span>
          </label>

          <label className="block text-sm">
            <span className="text-slate-600">Canonical URL (необязательно)</span>
            <input
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              type="url"
              value={form.canonicalUrl}
              onChange={(e) => patch('canonicalUrl', e.target.value)}
              maxLength={500}
              placeholder="https://example.com/"
            />
          </label>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {saving ? 'Сохранение…' : 'Сохранить на сайт'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
