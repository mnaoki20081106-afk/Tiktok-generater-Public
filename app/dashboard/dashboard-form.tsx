'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ExternalLink, ImageUp, Loader2, Save, Smartphone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useLocalDraft } from '@/lib/useLocalDraft';
import type { Site } from '@/lib/types';

type DraftFields = {
  slug: string;
  title: string;
  description: string;
};

export function DashboardForm({
  userId,
  site,
  siteUrlOrigin,
}: {
  userId: string;
  site: Site | null;
  siteUrlOrigin: string;
}) {
  const supabase = createClient();

  const { draft, setDraft, restoredFromDraft, clearDraft } = useLocalDraft<DraftFields>(
    `profile-draft:${userId}`,
    {
      slug: site?.slug ?? '',
      title: site?.title ?? '',
      description: site?.description ?? '',
    }
  );

  const [imageUrl, setImageUrl] = useState<string | null>(site?.image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function update<K extends keyof DraftFields>(key: K, value: DraftFields[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setStatus(null);
    try {
      const ext = file.name.split('.').pop();
      const path = `${userId}/profile-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('site-images')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('site-images').getPublicUrl(path);
      setImageUrl(data.publicUrl);
    } catch (err) {
      setStatus({
        type: 'error',
        text: err instanceof Error ? err.message : '画像のアップロードに失敗しました',
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      if (!draft.slug.trim()) throw new Error('slugを入力してください');
      if (!/^[a-z0-9-]+$/.test(draft.slug)) {
        throw new Error('slugは半角英小文字・数字・ハイフンのみ使用できます');
      }

      const { error } = await supabase.from('sites').upsert(
        {
          user_id: userId,
          slug: draft.slug.trim(),
          title: draft.title.trim(),
          description: draft.description.trim(),
          image_url: imageUrl,
          content_data: site?.content_data ?? {},
        },
        { onConflict: 'user_id' }
      );

      if (error) throw error;

      setStatus({ type: 'success', text: '保存しました' });
      clearDraft();
    } catch (err) {
      setStatus({
        type: 'error',
        text: err instanceof Error ? err.message : '保存に失敗しました',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      {restoredFromDraft && (
        <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <Smartphone size={14} />
          この端末に保存されていた未保存の編集内容を復元しました
        </p>
      )}

      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-slate-100">
          {imageUrl ? (
            <Image src={imageUrl} alt="" width={80} height={80} className="h-full w-full object-cover" />
          ) : (
            <ImageUp size={22} className="text-slate-400" />
          )}
        </div>
        <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50">
          {uploading ? 'アップロード中...' : '画像を選択'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
            disabled={uploading}
          />
        </label>
      </div>

      <div>
        <label htmlFor="slug" className="mb-1 block text-sm font-medium text-slate-700">
          公開URL(slug)
        </label>
        <div className="flex items-center rounded-lg border border-slate-300 focus-within:border-slate-500">
          <span className="px-3 text-sm text-slate-400">{siteUrlOrigin}/</span>
          <input
            id="slug"
            value={draft.slug}
            onChange={(e) => update('slug', e.target.value)}
            required
            pattern="[a-z0-9-]+"
            className="w-full rounded-r-lg py-2 pr-3 text-sm focus:outline-none"
            placeholder="my-name"
          />
        </div>
      </div>

      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700">
          タイトル
        </label>
        <input
          id="title"
          value={draft.title}
          onChange={(e) => update('title', e.target.value)}
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          placeholder="山田太郎"
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">
          自己紹介
        </label>
        <textarea
          id="description"
          value={draft.description}
          onChange={(e) => update('description', e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          placeholder="自己紹介文を入力してください"
        />
      </div>

      {status && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            status.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
          }`}
        >
          {status.text}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          保存する
        </button>
        {site?.slug && (
          <a
            href={`/${site.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            公開ページを見る <ExternalLink size={13} />
          </a>
        )}
      </div>
    </form>
  );
}
