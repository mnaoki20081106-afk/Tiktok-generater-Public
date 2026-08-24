'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getDraftImage, putDraftImage, clearDraftImages } from '@/lib/imageDraftDb';
import { compressToTargetSize } from '@/lib/imageCompress';
import { generateDestinationUrl } from '@/lib/link-generator';
import type { Site } from '@/lib/types';
import styles from './editor.module.css';

type ImageSlot = { kind: 'new'; blob: Blob } | { kind: 'existing'; url: string } | null;

type BgTransform = {
  naturalW: number;
  naturalH: number;
  dispW: number;
  dispH: number;
  baseScale: number;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

type DraftJson = {
  slug: string;
  tiktokUrl: string;
  cushionToggle: boolean;
  ogpTitle: string;
  username: string;
  description: string;
  musicName: string;
  likeCount: string;
  commentCount: string;
  shareCount: string;
  piToggle: boolean;
  piCount: string;
  floatToggle: boolean;
  bgTransform: { zoom: number; offsetX: number; offsetY: number } | null;
  existingUrls: { background?: string; avatar?: string; ogp?: string; icon?: string };
};

const IMAGE_NAMES = ['background', 'avatar', 'ogp', 'icon'] as const;
const SNAP_PX = 10;

// X(旧Twitter)のOGP画像の要件: 最小300×157px・最大4096×4096px・800KB以下が推奨・PNG/JPG/WebP
const OGP_MIN_WIDTH = 300;
const OGP_MIN_HEIGHT = 157;
const OGP_MAX_DIM = 4096;
const OGP_TARGET_BYTES = 800 * 1024;
const OGP_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export function DashboardForm({
  userId,
  site,
  siteUrlOrigin,
}: {
  userId: string;
  site: Site;
  siteUrlOrigin: string;
}) {
  const supabase = createClient();
  const rootRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type?: 'ok' | 'err' }>({ text: '' });
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);

  // 複数サイトを扱えるよう、下書きはユーザーとサイトの組み合わせごとに保存する
  const scopeKey = `${userId}:${site.id}`;
  const draftKey = `profile-editor-draft:${scopeKey}`;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
      root.querySelector<T>(`[data-id="${id}"]`)!;

    const bgArea = $('bgArea');
    const bgImg = $<HTMLImageElement>('bgImg');
    const bgInput = $<HTMLInputElement>('bgInput');
    const bgChangeBtn = $('bgChangeBtn');
    const bgEmpty = $('bgEmpty');
    const zoomRow = $('zoomRow');
    const zoomSlider = $<HTMLInputElement>('zoomSlider');
    const avatarArea = $('avatarArea');
    const avatarBox = $('avatarBox');
    const avatarInput = $<HTMLInputElement>('avatarInput');
    const discImg = $<HTMLImageElement>('discImg');
    const likeCountEl = $('likeCount');
    const commentCountEl = $('commentCount');
    const shareCountEl = $('shareCount');
    const usernameEl = $('username');
    const musicNameEl = $('musicName');
    const descDisplay = $('descDisplay');
    const descEdit = $<HTMLTextAreaElement>('descEdit');
    const descWrap = $('descWrap');
    const moreInline = $('moreInline');
    const pageIndicator = $('pageIndicator');
    const piToggle = $<HTMLInputElement>('piToggle');
    const piCount = $<HTMLInputElement>('piCount');
    const floatToggle = $<HTMLInputElement>('floatToggle');
    const floatPreview = $('floatPreview');
    const previewIconArea = $('previewIconArea');
    const previewIconPlaceholder = $('previewIconPlaceholder');
    const previewIconImg = $<HTMLImageElement>('previewIconImg');
    const ogpInput = $<HTMLInputElement>('ogpInput');
    const ogpLabel = $('ogpLabel');
    const ogpWarning = $('ogpWarning');
    const ogpWarningText = $('ogpWarningText');
    const ogpCompressBtn = $<HTMLButtonElement>('ogpCompressBtn');
    const iconInput = $<HTMLInputElement>('iconInput');
    const iconLabel = $('iconLabel');
    const slugInput = $<HTMLInputElement>('slug');
    const tiktokUrlInput = $<HTMLInputElement>('tiktokUrl');
    const cushionToggle = $<HTMLInputElement>('cushionToggle');
    const cushionHint = $('cushionHint');
    const ogpTitleInput = $<HTMLInputElement>('ogpTitle');
    const deployBtn = $<HTMLButtonElement>('deployBtn');
    const missingWarning = $('missingWarning');

    const state: { bg: ImageSlot; avatar: ImageSlot; ogp: ImageSlot; icon: ImageSlot } = {
      bg: null,
      avatar: null,
      ogp: null,
      icon: null,
    };

    const bgTransform: BgTransform = {
      naturalW: 0,
      naturalH: 0,
      dispW: 0,
      dispH: 0,
      baseScale: 1,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    };

    function saveState() {
      const data: DraftJson = {
        slug: slugInput.value,
        tiktokUrl: tiktokUrlInput.value,
        cushionToggle: cushionToggle.checked,
        ogpTitle: ogpTitleInput.value,
        username: usernameEl.textContent?.trim() ?? '',
        description: descText,
        musicName: musicNameEl.textContent?.trim() ?? '',
        likeCount: likeCountEl.textContent?.trim() ?? '',
        commentCount: commentCountEl.textContent?.trim() ?? '',
        shareCount: shareCountEl.textContent?.trim() ?? '',
        piToggle: piToggle.checked,
        piCount: piCount.value,
        floatToggle: floatToggle.checked,
        bgTransform:
          state.bg?.kind === 'new'
            ? { zoom: bgTransform.zoom, offsetX: bgTransform.offsetX, offsetY: bgTransform.offsetY }
            : null,
        existingUrls: {
          background: state.bg?.kind === 'existing' ? state.bg.url : undefined,
          avatar: state.avatar?.kind === 'existing' ? state.avatar.url : undefined,
          ogp: state.ogp?.kind === 'existing' ? state.ogp.url : undefined,
          icon: state.icon?.kind === 'existing' ? state.icon.url : undefined,
        },
      };
      try {
        window.localStorage.setItem(draftKey, JSON.stringify(data));
      } catch {
        // 容量超過などは致命的ではないため無視
      }
    }

    /**
     * 選択直後にFile本体を読み込んで独立したBlobへコピーする。
     * iOS SafariはiCloud上の写真を選択した場合など、選択直後のFileオブジェクトへの
     * 参照を長時間(数十秒〜)経ってからアップロードで読み直すと中身が空になることがある
     * (公開ボタンを押すまでの間に他の項目を編集しているとまさにこのケースに当たる)。
     * 選択のタイミングで一度バイト列を読み切ってコピーしておくことで、
     * 公開時にはこの独立したコピーをアップロードするため影響を受けない。
     */
    async function materializeBlob(file: Blob): Promise<Blob> {
      try {
        const buf = await file.arrayBuffer();
        return new Blob([buf], { type: file.type || 'application/octet-stream' });
      } catch {
        return file;
      }
    }

    /**
     * 画像を最大辺maxDimに収まるよう縮小し、JPEGに再エンコードして返す。
     * iPhoneのカメラで撮った写真はそのままだと数十MBになることがあり、
     * モバイル回線などでアップロード中に通信が途切れて「中身が空」として
     * 扱われる原因になり得るため、プロフィール画像・アプリアイコンはここで
     * 十分小さくしてからアップロードする(背景画像は別途bakeBackgroundで縮小・
     * 再エンコードしている。OGP画像は容量・形式の警告が意味を持つよう、
     * prepareOgpBlobで別途扱う)。canvasへ描画する過程で画像を完全に
     * デコードするため、materializeBlobと同様にFile参照の失効対策も兼ねる。
     */
    function resizeImageBlob(blob: Blob, maxDim: number, quality = 0.85): Promise<Blob> {
      return new Promise((resolve) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const { naturalWidth: w, naturalHeight: h } = img;
          const scale = Math.min(1, maxDim / Math.max(w, h));
          const outW = Math.max(1, Math.round(w * scale));
          const outH = Math.max(1, Math.round(h * scale));
          const canvas = document.createElement('canvas');
          canvas.width = outW;
          canvas.height = outH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            resolve(blob);
            return;
          }
          ctx.drawImage(img, 0, 0, outW, outH);
          canvas.toBlob(
            (out) => {
              URL.revokeObjectURL(url);
              resolve(out || blob);
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(blob);
        };
        img.src = url;
      });
    }

    // ===== OGP画像の要件チェック(サイズ・容量・形式) =====
    function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
          URL.revokeObjectURL(url);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('failed to load image'));
        };
        img.src = url;
      });
    }

    async function checkOgpImage(blob: Blob): Promise<{ issues: string[]; oversized: boolean }> {
      const issues: string[] = [];
      try {
        const { width, height } = await getImageDimensions(blob);
        if (width < OGP_MIN_WIDTH || height < OGP_MIN_HEIGHT) {
          issues.push(
            `画像サイズが小さすぎます(${width}×${height}px)。最小 ${OGP_MIN_WIDTH}×${OGP_MIN_HEIGHT}px 以上にしてください`
          );
        }
        if (width > OGP_MAX_DIM || height > OGP_MAX_DIM) {
          issues.push(`画像サイズが大きすぎます(${width}×${height}px)。最大 ${OGP_MAX_DIM}×${OGP_MAX_DIM}px 以下にしてください`);
        }
      } catch {
        issues.push('画像サイズを確認できませんでした');
      }
      if (!OGP_ALLOWED_TYPES.includes(blob.type)) {
        issues.push('対応していない画像形式です。PNG・JPG・WebPのいずれかを使用してください');
      }
      const oversized = blob.size > OGP_TARGET_BYTES;
      if (oversized) {
        issues.push(`画像容量が大きいです(約${Math.round(blob.size / 1024)}KB)。800KB以下が推奨されています`);
      }
      return { issues, oversized };
    }

    function renderOgpWarning(issues: string[], oversized: boolean) {
      if (issues.length === 0) {
        ogpWarning.classList.remove(styles.visible);
        ogpWarningText.textContent = '';
        ogpCompressBtn.style.display = 'none';
        return;
      }
      ogpWarningText.textContent = '⚠ ' + issues.join(' / ');
      ogpWarning.classList.add(styles.visible);
      ogpCompressBtn.style.display = oversized ? 'inline-flex' : 'none';
    }

    async function runOgpCheck() {
      if (state.ogp?.kind !== 'new') {
        renderOgpWarning([], false);
        return;
      }
      const { issues, oversized } = await checkOgpImage(state.ogp.blob);
      renderOgpWarning(issues, oversized);
    }

    /**
     * OGP画像は、選択されたファイルをそのまま(容量・形式のチェックが意味を
     * 持つように)保持する。他の画像(プロフィール/アイコン)のように選択直後に
     * 一律で1200px・JPEG品質0.85へ強制変換してしまうと、どんなに大きい元画像でも
     * 800KB未満に収まってしまい、容量・形式の警告が実質的に発生しなくなるため。
     * 最大辺が4096pxを超える場合のみ、Xの上限に収まるよう縮小する。
     */
    async function prepareOgpBlob(original: Blob): Promise<Blob> {
      const materialized = await materializeBlob(original);
      try {
        const { width, height } = await getImageDimensions(materialized);
        if (width > OGP_MAX_DIM || height > OGP_MAX_DIM) {
          return resizeImageBlob(materialized, OGP_MAX_DIM, 0.9);
        }
      } catch {
        // 寸法を取得できない場合はそのまま返し、checkOgpImage側の警告に委ねる
      }
      return materialized;
    }

    const OGP_EXT_BY_MIME: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };

    // OGP画像は変換せずそのままアップロードすることがあるため、拡張子・Content-Typeは
    // 実際のblobの形式に合わせる(常にjpgと決め打ちできない)
    function extensionForOgpBlob(slot: ImageSlot): string {
      if (slot?.kind === 'new') {
        return OGP_EXT_BY_MIME[slot.blob.type] || 'jpg';
      }
      return 'jpg';
    }

    ogpCompressBtn.addEventListener('click', async () => {
      if (state.ogp?.kind !== 'new') return;
      ogpCompressBtn.disabled = true;
      const originalLabel = ogpCompressBtn.textContent;
      ogpCompressBtn.textContent = '圧縮中...';
      try {
        const compressed = await compressToTargetSize(state.ogp.blob, { targetBytes: OGP_TARGET_BYTES });
        state.ogp = { kind: 'new', blob: compressed };
        putDraftImage(scopeKey, 'ogp', compressed);
        saveState();
        await runOgpCheck();
      } catch {
        ogpWarningText.textContent = '⚠ 圧縮に失敗しました。別の画像をお試しください';
      } finally {
        ogpCompressBtn.disabled = false;
        ogpCompressBtn.textContent = originalLabel;
      }
    });

    // ===== 背景画像: ズーム・パン・スナップ =====
    function clampOffsets() {
      const imgW = bgTransform.naturalW * bgTransform.baseScale * bgTransform.zoom;
      const imgH = bgTransform.naturalH * bgTransform.baseScale * bgTransform.zoom;
      const dX = bgTransform.dispW - imgW;
      const dY = bgTransform.dispH - imgH;
      const minX = Math.min(0, dX);
      const maxX = Math.max(0, dX);
      const minY = Math.min(0, dY);
      const maxY = Math.max(0, dY);
      bgTransform.offsetX = Math.max(minX, Math.min(maxX, bgTransform.offsetX));
      bgTransform.offsetY = Math.max(minY, Math.min(maxY, bgTransform.offsetY));
      return { imgW, imgH, minX, minY, maxX, maxY };
    }

    function applyBgTransform() {
      const { imgW, imgH } = clampOffsets();
      bgImg.style.width = imgW + 'px';
      bgImg.style.height = imgH + 'px';
      bgImg.style.left = bgTransform.offsetX + 'px';
      bgImg.style.top = bgTransform.offsetY + 'px';
    }

    function snapAxis(offset: number, min: number, max: number) {
      const candidates = [0, min, max];
      for (const c of candidates) {
        if (Math.abs(offset - c) < SNAP_PX) return c;
      }
      return offset;
    }
    function snapBgOffsets() {
      const { minX, minY, maxX, maxY } = clampOffsets();
      bgTransform.offsetX = snapAxis(bgTransform.offsetX, minX, maxX);
      bgTransform.offsetY = snapAxis(bgTransform.offsetY, minY, maxY);
      applyBgTransform();
    }

    function showBgPreview(url: string) {
      bgImg.src = url;
      bgImg.style.display = 'block';
      bgEmpty.style.display = 'none';
      bgArea.classList.add(styles.hasImage);
      bgChangeBtn.style.display = 'block';
    }

    function loadBackgroundFile(
      file: Blob,
      opts: { savedTransform?: { zoom: number; offsetX: number; offsetY: number } | null; persist?: boolean } = {}
    ) {
      state.bg = { kind: 'new', blob: file };
      const url = URL.createObjectURL(file);
      bgImg.onload = () => {
        const rect = bgArea.getBoundingClientRect();
        bgTransform.naturalW = bgImg.naturalWidth;
        bgTransform.naturalH = bgImg.naturalHeight;
        bgTransform.dispW = rect.width;
        bgTransform.dispH = rect.height;
        bgTransform.baseScale = Math.max(
          bgTransform.dispW / bgTransform.naturalW,
          bgTransform.dispH / bgTransform.naturalH
        );
        const containScale = Math.min(
          bgTransform.dispW / bgTransform.naturalW,
          bgTransform.dispH / bgTransform.naturalH
        );
        const minZoom = Math.max(0.2, containScale / bgTransform.baseScale);
        if (opts.savedTransform) {
          // 復元時のコンテナ・画像の実測値がズレていても、保存されていたzoomを
          // そのまま適用すると画像が極端に縮小され(レターボックスが背景の黒だけに
          // なるなど)、見た目が真っ黒になったように見えることがあるため、
          // 現在の測定値から出したmin/maxへ必ずクランプする
          bgTransform.zoom = Math.min(4, Math.max(minZoom, opts.savedTransform.zoom || 1));
          bgTransform.offsetX = opts.savedTransform.offsetX || 0;
          bgTransform.offsetY = opts.savedTransform.offsetY || 0;
        } else {
          bgTransform.zoom = 1;
          const imgW = bgTransform.naturalW * bgTransform.baseScale;
          const imgH = bgTransform.naturalH * bgTransform.baseScale;
          bgTransform.offsetX = (bgTransform.dispW - imgW) / 2;
          bgTransform.offsetY = (bgTransform.dispH - imgH) / 2;
        }
        applyBgTransform();
        zoomSlider.min = String(minZoom);
        zoomSlider.max = '4';
        zoomSlider.value = String(bgTransform.zoom);
        zoomRow.classList.add(styles.visible);
      };
      showBgPreview(url);
      if (opts.persist !== false) {
        putDraftImage(scopeKey, 'background', file);
        saveState();
      }
      check();
    }

    bgEmpty.addEventListener('click', () => bgInput.click());
    bgChangeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bgInput.click();
    });
    bgInput.addEventListener('change', async function () {
      if (this.files && this.files.length > 0) {
        const file = await materializeBlob(this.files[0]);
        loadBackgroundFile(file);
      }
    });

    let bgDrag: { startX: number; startY: number; offsetX: number; offsetY: number } | null = null;
    bgArea.addEventListener('pointerdown', (e) => {
      if (state.bg?.kind !== 'new') return;
      bgDrag = { startX: e.clientX, startY: e.clientY, offsetX: bgTransform.offsetX, offsetY: bgTransform.offsetY };
      bgArea.classList.add(styles.dragging);
      bgArea.setPointerCapture(e.pointerId);
    });
    bgArea.addEventListener('pointermove', (e) => {
      if (!bgDrag) return;
      bgTransform.offsetX = bgDrag.offsetX + (e.clientX - bgDrag.startX);
      bgTransform.offsetY = bgDrag.offsetY + (e.clientY - bgDrag.startY);
      applyBgTransform();
    });
    function endBgDrag() {
      if (!bgDrag) return;
      bgDrag = null;
      bgArea.classList.remove(styles.dragging);
      snapBgOffsets();
      saveState();
    }
    bgArea.addEventListener('pointerup', endBgDrag);
    bgArea.addEventListener('pointercancel', endBgDrag);

    zoomSlider.addEventListener('input', () => {
      bgTransform.zoom = parseFloat(zoomSlider.value) || 1;
      applyBgTransform();
    });
    zoomSlider.addEventListener('change', () => {
      snapBgOffsets();
      saveState();
    });

    function bakeBackground(): Promise<Blob | null> {
      return new Promise((resolve) => {
        if (state.bg?.kind !== 'new') {
          resolve(null);
          return;
        }
        if (!bgTransform.naturalW || !bgTransform.dispW) {
          resolve(state.bg.blob);
          return;
        }
        const bakeW = 1080;
        const bakeH = Math.round((bakeW * 19.5) / 9);
        const canvas = document.createElement('canvas');
        canvas.width = bakeW;
        canvas.height = bakeH;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, bakeW, bakeH);
        const scaleRatio = bakeW / bgTransform.dispW;
        const effScale = bgTransform.baseScale * bgTransform.zoom * scaleRatio;
        const destW = bgTransform.naturalW * effScale;
        const destH = bgTransform.naturalH * effScale;
        const destX = bgTransform.offsetX * scaleRatio;
        const destY = bgTransform.offsetY * scaleRatio;
        ctx.drawImage(bgImg, 0, 0, bgTransform.naturalW, bgTransform.naturalH, destX, destY, destW, destH);
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      });
    }

    // ===== アバター =====
    function applyAvatarPreview(url: string) {
      avatarBox.innerHTML = '';
      const img = document.createElement('img');
      img.src = url;
      img.alt = '';
      avatarBox.appendChild(img);
      discImg.src = url;
      discImg.style.display = 'block';
    }
    avatarArea.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', async function () {
      if (this.files && this.files.length > 0) {
        const file = await resizeImageBlob(this.files[0], 800);
        state.avatar = { kind: 'new', blob: file };
        applyAvatarPreview(URL.createObjectURL(file));
        putDraftImage(scopeKey, 'avatar', file);
        saveState();
      }
    });

    // ===== OGP画像 / アプリアイコン =====
    function bindFilePicker(
      input: HTMLInputElement,
      label: HTMLElement,
      maxDim: number,
      onPicked: (file: Blob) => void
    ) {
      // input[type=file]はCSS(.card input[type=file])で非表示にしているため、
      // ラベルをクリックした際に明示的にファイル選択ダイアログを開く必要がある
      label.addEventListener('click', () => input.click());
      input.addEventListener('change', async function () {
        if (this.files && this.files.length > 0) {
          const original = this.files[0];
          const file = await resizeImageBlob(original, maxDim);
          onPicked(file);
          const span = label.querySelector('span');
          if (span) span.textContent = original.name;
          label.classList.add(styles.selected);
        }
        check();
      });
    }
    // OGP画像だけはbindFilePickerの一律リサイズを使わず、容量・形式チェックが
    // 意味を持つよう専用の処理(prepareOgpBlob)を通す
    ogpLabel.addEventListener('click', () => ogpInput.click());
    ogpInput.addEventListener('change', async function () {
      if (this.files && this.files.length > 0) {
        const original = this.files[0];
        const file = await prepareOgpBlob(original);
        state.ogp = { kind: 'new', blob: file };
        putDraftImage(scopeKey, 'ogp', file);
        saveState();
        await runOgpCheck();
        const span = ogpLabel.querySelector('span');
        if (span) span.textContent = original.name;
        ogpLabel.classList.add(styles.selected);
      }
      check();
    });

    function applyIconPreview(url: string) {
      previewIconImg.src = url;
      previewIconImg.style.display = 'block';
      previewIconPlaceholder.style.display = 'none';
    }
    bindFilePicker(iconInput, iconLabel, 512, (f) => {
      state.icon = { kind: 'new', blob: f };
      applyIconPreview(URL.createObjectURL(f));
      putDraftImage(scopeKey, 'icon', f);
      saveState();
    });

    // ===== クッションページの有無 =====
    /* ON  … 遷移先URLを一切加工せずそのまま保存する(従来どおりの挙動)。
             クッションページ経由にしたい場合は /tools/link-generator で生成したURLを貼る。
       OFF … 保存時にジェネレーター(展開＋サニタイズ)を通したURLを保存する。 */
    function renderCushionHint() {
      cushionHint.textContent = cushionToggle.checked
        ? '遷移先URLはそのまま保存されます。クッションページ経由のURLは、リンクジェネレーターで生成したものを貼り付けてください。'
        : '保存時に、入力した遷移先URLへ自動でリンクジェネレーターを適用します(短縮リンクは展開し、ディープリンク系パラメータを除去したURLに書き換えます)。';
    }
    renderCushionHint();
    cushionToggle.addEventListener('change', () => {
      renderCushionHint();
      saveState();
    });

    // ===== 誘導ダイアログのプレビュー表示切り替え =====
    floatToggle.addEventListener('change', () => {
      floatPreview.classList.toggle(styles.visible, floatToggle.checked);
      saveState();
    });
    previewIconArea.addEventListener('click', (e) => {
      e.stopPropagation();
      iconInput.click();
    });

    // ===== 数値・テキストのタップ編集(contenteditable) =====
    (['likeCount', 'commentCount', 'shareCount', 'username', 'musicName'] as const).forEach((id) => {
      const el = $(id);
      el.addEventListener('focus', () => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          el.blur();
        }
      });
      el.addEventListener('blur', () => {
        if (!el.textContent?.trim()) {
          el.textContent = id === 'username' ? 'username' : id === 'musicName' ? 'オリジナル楽曲' : '0';
        }
        saveState();
      });
    });

    // ===== 動画説明(ハッシュタグ強調 + 続きを見る) =====
    let descText = '';
    function escDesc(s: string) {
      return s.replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
      );
    }
    function renderDescCut(n: number | null) {
      const t = n === null ? descText : descText.slice(0, n);
      descDisplay.innerHTML = escDesc(t).replace(
        /(^|\s)(#[^\s#]+)/g,
        (m, pre, tag) => pre + '<span class="' + styles.tag + '">' + tag + '</span>'
      );
    }
    function renderDesc() {
      moreInline.style.display = 'none';
      if (!descText.trim()) {
        descDisplay.textContent = 'タップして動画の説明・ハッシュタグを入力';
        return;
      }
      renderDescCut(null);
      requestAnimationFrame(() => {
        if (descWrap.scrollHeight <= descWrap.clientHeight + 1) return;
        moreInline.style.display = 'inline';
        let lo = 0;
        let hi = descText.length;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          renderDescCut(mid);
          if (descWrap.scrollHeight <= descWrap.clientHeight + 1) lo = mid;
          else hi = mid - 1;
        }
        renderDescCut(lo);
      });
    }
    descWrap.addEventListener('click', () => {
      descEdit.value = descText;
      descWrap.style.display = 'none';
      descEdit.style.display = 'block';
      descEdit.focus();
    });
    descEdit.addEventListener('blur', () => {
      descText = descEdit.value;
      descEdit.style.display = 'none';
      descWrap.style.display = 'block';
      renderDesc();
      check();
      saveState();
    });

    // ===== ページインジケーター(見た目のみ) =====
    function renderPageIndicatorPreview() {
      if (!piToggle.checked) {
        pageIndicator.style.display = 'none';
        pageIndicator.innerHTML = '';
        return;
      }
      let n = parseInt(piCount.value, 10);
      if (!Number.isFinite(n) || n < 1) n = 1;
      if (n > 6) n = 6;
      piCount.value = String(n);
      let dots = '';
      for (let i = 0; i < n; i++) dots += '<span class="' + styles.piDot + (i === 0 ? ' ' + styles.active : '') + '"></span>';
      pageIndicator.innerHTML = dots;
      pageIndicator.style.display = 'flex';
    }
    piToggle.addEventListener('change', () => {
      renderPageIndicatorPreview();
      saveState();
    });
    piCount.addEventListener('input', () => {
      renderPageIndicatorPreview();
      saveState();
    });

    // ===== 必須項目チェック =====
    type RequiredField = { test: () => boolean; label: string; el: () => HTMLElement };
    const REQUIRED_FIELDS: RequiredField[] = [
      { test: () => !!state.bg, label: '背景画像', el: () => bgArea },
      { test: () => !!state.ogp, label: 'OGP画像', el: () => ogpLabel },
      { test: () => !!state.icon, label: 'アプリアイコン画像', el: () => iconLabel },
      { test: () => !!slugInput.value.trim(), label: '公開URL(slug)', el: () => slugInput },
      { test: () => !!tiktokUrlInput.value.trim(), label: 'TikTokプロフィールURL', el: () => tiktokUrlInput },
      { test: () => !!ogpTitleInput.value.trim(), label: 'OGPタイトル', el: () => ogpTitleInput },
    ];

    function getMissingFields() {
      return REQUIRED_FIELDS.filter((f) => !f.test());
    }

    function check() {
      const missing = getMissingFields();
      deployBtn.disabled = missing.length > 0;
      REQUIRED_FIELDS.forEach((f) => {
        f.el().classList.toggle(styles.missing, !f.test());
      });
      if (missing.length > 0) {
        missingWarning.textContent = '⚠ 未入力の項目があります: ' + missing.map((f) => f.label).join('、');
        missingWarning.classList.add(styles.visible);
      } else {
        missingWarning.classList.remove(styles.visible);
      }
    }

    ['slug', 'tiktokUrl', 'ogpTitle'].forEach((id) => {
      $(id).addEventListener('input', () => {
        check();
        saveState();
      });
    });

    // ===== 保存(Supabaseへ、RLSでauth.uid()=user_idの行のみ許可) =====
    async function uploadImageSlot(
      slot: ImageSlot,
      path: string,
      label: string,
      contentType: string
    ): Promise<string | null> {
      if (!slot) return null;
      if (slot.kind === 'existing') return slot.url;
      if (slot.blob.size === 0) {
        // iPhone/iPadでiCloud上の写真(端末にダウンロード未完了)を選んだ場合など、
        // ファイルの中身が空のまま渡ってくることがある。生のエラー(No content provided等)を
        // そのまま表示すると原因が分かりづらいため、具体的な対処法を案内する
        throw new Error(
          `${label}の読み込みに失敗しました(データが空です)。画像を選び直してください。iPhone/iPadでiCloud上の写真を選んだ場合は、写真アプリで一度開いて端末にダウンロードしてから選び直すと解決することがあります。`
        );
      }
      const { error } = await supabase.storage.from('site-images').upload(path, slot.blob, {
        upsert: true,
        contentType,
      });
      if (error) throw error;
      return supabase.storage.from('site-images').getPublicUrl(path).data.publicUrl;
    }

    deployBtn.addEventListener('click', async () => {
      const missing = getMissingFields();
      if (missing.length > 0) {
        check();
        return;
      }
      deployBtn.disabled = true;
      setResultUrl(null);
      setSaving(true);
      setStatusMsg({ text: '保存中... しばらくお待ちください' });
      try {
        const slug = slugInput.value.trim().toLowerCase();
        if (!/^[a-z0-9-]+$/.test(slug)) {
          throw new Error('公開URL(slug)は半角英小文字・数字・ハイフンのみ使用できます');
        }

        /* クッションページOFFのときだけ、遷移先URLにジェネレーターを適用する。
           画像のアップロードより先に実行するのは、ここで失敗したら保存自体を中断するため
           (未サニタイズのURLが公開されるのを防ぐ)。失敗しても画像をアップロードし終えた後だと
           Storageに不要なファイルだけが残ってしまう。 */
        let destinationUrl = tiktokUrlInput.value.trim();
        if (!cushionToggle.checked) {
          setStatusMsg({ text: '遷移先URLを生成中... (数十秒かかる場合があります)' });
          try {
            const built = await generateDestinationUrl(destinationUrl);
            destinationUrl = built.url;
            // 生成結果を入力欄にも反映して、何が保存されるのかを見えるようにする
            tiktokUrlInput.value = destinationUrl;
            saveState();
          } catch (e) {
            throw new Error(
              '遷移先URLの生成に失敗したため保存を中断しました。' +
                (e instanceof Error ? e.message : String(e)) +
                '\nそのままのURLで公開する場合は「クッションページを挟む」をONにしてください。'
            );
          }
          setStatusMsg({ text: '保存中... しばらくお待ちください' });
        }

        const bakedBg = await bakeBackground();
        const bgSlot: ImageSlot = bakedBg ? { kind: 'new', blob: bakedBg } : state.bg;

        const [backgroundUrl, avatarUrl, ogpUrl, iconUrl] = await Promise.all([
          uploadImageSlot(bgSlot, `${userId}/${site.id}/background-${Date.now()}.png`, '背景画像', 'image/png'),
          uploadImageSlot(
            state.avatar,
            `${userId}/${site.id}/avatar-${Date.now()}.jpg`,
            'プロフィール画像',
            'image/jpeg'
          ),
          uploadImageSlot(
            state.ogp,
            `${userId}/${site.id}/ogp-${Date.now()}.${extensionForOgpBlob(state.ogp)}`,
            'OGP画像',
            state.ogp?.kind === 'new' ? state.ogp.blob.type || 'image/jpeg' : 'image/jpeg'
          ),
          uploadImageSlot(
            state.icon,
            `${userId}/${site.id}/icon-${Date.now()}.jpg`,
            'アプリアイコン画像',
            'image/jpeg'
          ),
        ]);

        const { error } = await supabase
          .from('sites')
          .update({
            slug,
            title: ogpTitleInput.value.trim(),
            description: descText,
            image_url: avatarUrl,
            content_data: {
              username: usernameEl.textContent?.trim() || slug,
              tiktokUrl: destinationUrl,
              useCushionPage: cushionToggle.checked,
              musicName: musicNameEl.textContent?.trim() || 'オリジナル楽曲',
              likeCount: likeCountEl.textContent?.trim() || '0',
              commentCount: commentCountEl.textContent?.trim() || '0',
              shareCount: shareCountEl.textContent?.trim() || '0',
              showPageIndicator: piToggle.checked,
              pageIndicatorCount: piCount.value.trim() || '3',
              images: {
                background: backgroundUrl ?? undefined,
                ogpImage: ogpUrl ?? undefined,
                appIcon: iconUrl ?? undefined,
              },
            },
          })
          .eq('id', site.id)
          .eq('user_id', userId);

        if (error) {
          if (error.code === '23505') {
            throw new Error('そのURL(slug)はすでに使われています。別の名前にしてください');
          }
          throw error;
        }

        setStatusMsg({ text: '✓ 公開しました', type: 'ok' });
        setResultUrl(`${siteUrlOrigin}/${slug}`);
        try {
          window.localStorage.removeItem(draftKey);
        } catch {
          // noop
        }
        await clearDraftImages(scopeKey, [...IMAGE_NAMES]);
      } catch (err) {
        setStatusMsg({ text: 'エラー: ' + (err instanceof Error ? err.message : '保存に失敗しました'), type: 'err' });
      } finally {
        deployBtn.disabled = false;
        setSaving(false);
      }
    });

    // ===== 初期化: 下書き(端末)→既存サイトデータの順に復元 =====
    async function init() {
      let saved: DraftJson | null = null;
      try {
        saved = JSON.parse(window.localStorage.getItem(draftKey) || 'null');
      } catch {
        saved = null;
      }

      const cd = site.content_data ?? {};
      const images = (cd.images as { background?: string; ogpImage?: string; appIcon?: string } | undefined) ?? {};

      slugInput.value = saved?.slug || site.slug || '';
      tiktokUrlInput.value = saved?.tiktokUrl || (cd.tiktokUrl as string) || '';
      // 未設定の既存サイトはON(=遷移先URLを加工しない)として扱い、従来の挙動を保つ
      cushionToggle.checked = saved ? saved.cushionToggle : cd.useCushionPage !== false;
      renderCushionHint();
      ogpTitleInput.value = saved?.ogpTitle || site.title || '';
      usernameEl.textContent = saved?.username || (cd.username as string) || 'username';
      descText = saved?.description ?? site.description ?? '';
      musicNameEl.textContent = saved?.musicName || (cd.musicName as string) || 'オリジナル楽曲';
      likeCountEl.textContent = saved?.likeCount || (cd.likeCount as string) || '0';
      commentCountEl.textContent = saved?.commentCount || (cd.commentCount as string) || '0';
      shareCountEl.textContent = saved?.shareCount || (cd.shareCount as string) || '0';
      piToggle.checked = saved ? saved.piToggle : Boolean(cd.showPageIndicator);
      piCount.value = saved?.piCount || (cd.pageIndicatorCount as string) || '3';
      floatToggle.checked = saved?.floatToggle ?? false;
      floatPreview.classList.toggle(styles.visible, floatToggle.checked);
      renderDesc();
      renderPageIndicatorPreview();
      if (saved) setRestoredFromDraft(true);

      const [bgBlob, avatarBlob, ogpBlob, iconBlob] = await Promise.all([
        getDraftImage(scopeKey, 'background'),
        getDraftImage(scopeKey, 'avatar'),
        getDraftImage(scopeKey, 'ogp'),
        getDraftImage(scopeKey, 'icon'),
      ]);

      if (bgBlob) {
        loadBackgroundFile(bgBlob, { savedTransform: saved?.bgTransform ?? null, persist: false });
      } else {
        const existingBg = saved?.existingUrls.background || images.background;
        if (existingBg) {
          state.bg = { kind: 'existing', url: existingBg };
          showBgPreview(existingBg);
        }
      }

      if (avatarBlob) {
        state.avatar = { kind: 'new', blob: avatarBlob };
        applyAvatarPreview(URL.createObjectURL(avatarBlob));
      } else {
        const existingAvatar = saved?.existingUrls.avatar || site.image_url;
        if (existingAvatar) {
          state.avatar = { kind: 'existing', url: existingAvatar };
          applyAvatarPreview(existingAvatar);
        }
      }

      if (ogpBlob) {
        state.ogp = { kind: 'new', blob: ogpBlob };
        const span = ogpLabel.querySelector('span');
        if (span) span.textContent = '保存済みの画像(端末)';
        ogpLabel.classList.add(styles.selected);
      } else {
        const existingOgp = saved?.existingUrls.ogp || images.ogpImage;
        if (existingOgp) {
          state.ogp = { kind: 'existing', url: existingOgp };
          const span = ogpLabel.querySelector('span');
          if (span) span.textContent = '設定済みの画像';
          ogpLabel.classList.add(styles.selected);
        }
      }
      runOgpCheck();

      if (iconBlob) {
        state.icon = { kind: 'new', blob: iconBlob };
        const url = URL.createObjectURL(iconBlob);
        applyIconPreview(url);
        const span = iconLabel.querySelector('span');
        if (span) span.textContent = '保存済みの画像(端末)';
        iconLabel.classList.add(styles.selected);
      } else {
        const existingIcon = saved?.existingUrls.icon || images.appIcon;
        if (existingIcon) {
          state.icon = { kind: 'existing', url: existingIcon };
          applyIconPreview(existingIcon);
          const span = iconLabel.querySelector('span');
          if (span) span.textContent = '設定済みの画像';
          iconLabel.classList.add(styles.selected);
        }
      }

      check();
    }
    init();
    // このuseEffectはマウント時に一度だけDOMへ直接イベントを配線する(旧docs/index.htmlのvanilla JSを踏襲)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={rootRef} className={styles.root}>
      <div className={styles.layout}>
        <div className={styles.previewCol}>
          <div className={styles.phone}>
            <div className={styles.bg} data-id="bgArea">
              <div className={styles.bgEmpty} data-id="bgEmpty">
                タップして
                <br />
                背景画像を選択
              </div>
              <img data-id="bgImg" style={{ display: 'none' }} alt="" />
              <button type="button" className={styles.editBadge} data-id="bgChangeBtn" style={{ display: 'none' }}>
                画像を変更
              </button>
            </div>

            <div className={styles.rail}>
              <div className={styles.railAvatar} data-id="avatarArea">
                <div className={styles.avatar} data-id="avatarBox">
                  ＋
                </div>
                <svg className={styles.follow} viewBox="0 0 28 28">
                  <path
                    fill="#FE2C55"
                    d="M14 25C20.6274 25 26 19.6274 26 13C26 6.37258 20.6274 1 14 1C7.37258 1 2 6.37258 2 13C2 19.6274 7.37258 25 14 25Z"
                  />
                  <path
                    fill="#fff"
                    d="M9.5 14C9.22386 14 9 13.7761 9 13.5V12.5C9 12.2239 9.22386 12 9.5 12H18.5C18.7761 12 19 12.2239 19 12.5V13.5C19 13.7761 18.7761 14 18.5 14H9.5Z"
                  />
                  <path
                    fill="#fff"
                    d="M13 8.5C13 8.22386 13.2239 8 13.5 8H14.5C14.7761 8 15 8.22386 15 8.5V17.5C15 17.7761 14.7761 18 14.5 18H13.5C13.2239 18 13 17.7761 13 17.5V8.5Z"
                  />
                </svg>
              </div>
              <div className={styles.railItem}>
                <svg viewBox="0 0 48 48">
                  <path
                    fill="#fff"
                    d="M24 9.44c3.2-4.03 7.61-5.56 12-4.67 2.31.47 5.59 2.28 7.75 5.48 2.26 3.32 3.21 7.99.98 13.85-1.75 4.57-5.5 8.83-9.28 12.2a56.6 56.6 0 0 1-10.52 7.47l-.93.49-.93-.49a56.6 56.6 0 0 1-10.52-7.47c-3.78-3.37-7.53-7.63-9.28-12.2-2.24-5.86-1.28-10.53.98-13.85C6.4 7.05 9.69 5.24 12 4.77c4.39-.9 8.8.64 12 4.67Z"
                  />
                </svg>
                <span contentEditable suppressContentEditableWarning data-id="likeCount">
                  3.1k
                </span>
              </div>
              <div className={styles.railItem}>
                <svg viewBox="0 0 48 48">
                  <path
                    fill="#fff"
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M38.5 35.31c4.1-4.11 6.5-8.4 6.5-13.38C45 11.8 35.73 3.6 24.3 3.6S3.6 11.8 3.6 21.93C3.6 32.05 13.17 39 24.6 39v3.36c0 1.06 1.1 1.75 2.04 1.24 2.92-1.58 8.33-4.76 11.85-8.29ZM14.23 19.46a2.95 2.95 0 0 1 2.96 2.93 2.95 2.95 0 0 1-2.96 2.94 2.95 2.95 0 0 1-2.95-2.94 2.95 2.95 0 0 1 2.95-2.93Zm13.02 2.93a2.95 2.95 0 0 0-2.96-2.93 2.95 2.95 0 0 0-2.96 2.93 2.95 2.95 0 0 0 2.96 2.94 2.95 2.95 0 0 0 2.96-2.94Zm7.1-2.93a2.95 2.95 0 0 1 2.95 2.93 2.95 2.95 0 0 1-2.96 2.94 2.95 2.95 0 0 1-2.95-2.94 2.95 2.95 0 0 1 2.95-2.93Z"
                  />
                </svg>
                <span contentEditable suppressContentEditableWarning data-id="commentCount">
                  686
                </span>
              </div>
              <div className={styles.railItem}>
                <svg viewBox="0 0 48 48">
                  <path
                    fill="#fff"
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M25.56 4.07a1.98 1.98 0 0 0-2.15-.42 1.95 1.95 0 0 0-1.21 1.8v8.34c-5.4.35-10.04 2.2-13.43 5.68C4.97 23.35 3 29.03 3 36.19c0 .79.48 1.5 1.22 1.8.73.3 1.58.13 2.14-.42 3.34-3.31 7.65-4.56 11.25-4.95 1.8-.2 3.37-.18 4.5-.1h.09v9.03c0 .78.46 1.48 1.18 1.79.72.3 1.56.16 2.13-.37l18.87-17.49a1.94 1.94 0 0 0 .04-2.8L25.56 4.07Z"
                  />
                </svg>
                <span contentEditable suppressContentEditableWarning data-id="shareCount">
                  2.8k
                </span>
              </div>
              <div className={styles.disc} data-id="discArea">
                <img data-id="discImg" style={{ display: 'none' }} alt="" />
              </div>
            </div>

            <div className={styles.caption}>
              <div className={styles.uname} contentEditable suppressContentEditableWarning data-id="username">
                username
              </div>
              <div className={styles.descWrap} data-id="descWrap">
                <span data-id="descDisplay">タップして動画の説明・ハッシュタグを入力</span>
                <span className={styles.moreInline} data-id="moreInline">
                  もっと見る
                </span>
              </div>
              <textarea
                className={styles.descEdit}
                data-id="descEdit"
                rows={3}
                placeholder="例: 今日の一コマ #日常 #TikTok"
              />
              <div className={styles.music}>
                ♫
                <span contentEditable suppressContentEditableWarning data-id="musicName">
                  オリジナル楽曲
                </span>
              </div>
            </div>

            <div className={styles.pageIndicator} data-id="pageIndicator" style={{ display: 'none' }} />

            <div className={styles.navbar}>
              <div className={styles.navItem}>
                <svg viewBox="0 0 48 48" fill="#fff">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M24.9505 7.84001C24.3975 7.38666 23.6014 7.38666 23.0485 7.84003L6.94846 21.04C6.45839 21.4418 6.2737 22.1083 6.48706 22.705C6.70041 23.3017 7.26576 23.7 7.89949 23.7H10.2311L11.4232 36.7278C11.5409 38.0149 12.6203 39 13.9128 39H21.5C22.0523 39 22.5 38.5523 22.5 38V28.3153C22.5 27.763 22.9477 27.3153 23.5 27.3153H24.5C25.0523 27.3153 25.5 27.763 25.5 28.3153V38C25.5 38.5523 25.9477 39 26.5 39H34.0874C35.3798 39 36.4592 38.0149 36.577 36.7278L37.7691 23.7H40.1001C40.7338 23.7 41.2992 23.3017 41.5125 22.705C41.7259 22.1082 41.5412 21.4418 41.0511 21.04L24.9505 7.84001Z"
                  />
                </svg>
                <span className={styles.navLabel}>ホーム</span>
              </div>
              <div className={styles.navItem} style={{ opacity: 0.75 }}>
                <svg viewBox="0 0 36 36" fill="#fff">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M18 28.0547C23.553 28.0547 28.0547 23.5531 28.0547 18C28.0547 12.4469 23.553 7.94531 18 7.94531C12.4469 7.94531 7.94531 12.4469 7.94531 18C7.94531 23.5531 12.4469 28.0547 18 28.0547ZM30.375 18C30.375 24.8345 24.8345 30.375 18 30.375C11.1655 30.375 5.625 24.8345 5.625 18C5.625 11.1655 11.1655 5.625 18 5.625C24.8345 5.625 30.375 11.1655 30.375 18Z"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M20.3508 20.3864C20.712 20.1679 20.9645 19.8074 21.0462 19.3932L22.427 12.3948C22.5027 12.0113 22.0871 11.7204 21.7527 11.9226L15.6486 15.6137C15.2874 15.8322 15.0349 16.1928 14.9532 16.6069L13.5724 23.6053C13.4967 23.9888 13.9123 24.2797 14.2467 24.0775L20.3508 20.3864ZM16.5684 20.0442L18.9029 18.6325L19.431 15.9559L17.0965 17.3676L16.5684 20.0442Z"
                  />
                </svg>
                <span className={styles.navLabel}>トレンド</span>
              </div>
              <div className={styles.navPlus}>
                <svg viewBox="0 0 75 49" fill="none">
                  <path
                    fill="#FA2D6C"
                    fillRule="evenodd"
                    d="M23.5 23.3c0-4.48 0-6.72.872-8.432a8 8 0 0 1 3.496-3.496C29.58 10.5 31.82 10.5 36.3 10.5h9.9c4.48 0 6.72 0 8.432.872a8 8 0 0 1 3.496 3.496C59 16.58 59 18.82 59 23.3v2.4c0 4.48 0 6.72-.872 8.432a8 8 0 0 1-3.496 3.496c-1.711.872-3.952.872-8.432.872h-9.9c-4.48 0-6.72 0-8.432-.872a8 8 0 0 1-3.496-3.496C23.5 32.42 23.5 30.18 23.5 25.7z"
                    clipRule="evenodd"
                  />
                  <path
                    fill="#20D5EC"
                    fillRule="evenodd"
                    d="M16 23.3c0-4.48 0-6.72.872-8.432a8 8 0 0 1 3.496-3.496C22.08 10.5 24.32 10.5 28.8 10.5h9.9c4.48 0 6.72 0 8.432.872a8 8 0 0 1 3.496 3.496c.872 1.711.872 3.952.872 8.432v2.4c0 4.48 0 6.72-.872 8.432a8 8 0 0 1-3.496 3.496c-1.711.872-3.952.872-8.432.872h-9.9c-4.48 0-6.72 0-8.432-.872a8 8 0 0 1-3.496-3.496C16 32.42 16 30.18 16 25.7z"
                    clipRule="evenodd"
                  />
                  <rect width="36" height="28" x="19.5" y="10.5" fill="#fff" rx="8" />
                  <path
                    fill="#161823"
                    fillRule="evenodd"
                    d="M36.5 18.25a.5.5 0 0 0-.5.5v4.75h-4.75a.5.5 0 0 0-.5.5v1.5a.5.5 0 0 0 .5.5H36v4.75a.5.5 0 0 0 .5.5H38a.5.5 0 0 0 .5-.5V26h4.75a.5.5 0 0 0 .5-.5V24a.5.5 0 0 0-.5-.5H38.5v-4.75a.5.5 0 0 0-.5-.5z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className={styles.navItem} style={{ opacity: 0.75 }}>
                <svg viewBox="0 0 32 32" fill="#fff">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M24.0362 21.3333H18.5243L15.9983 24.4208L13.4721 21.3333H7.96047L7.99557 8H24.0009L24.0362 21.3333ZM24.3705 23.3333H19.4721L17.2883 26.0026C16.6215 26.8176 15.3753 26.8176 14.7084 26.0026L12.5243 23.3333H7.62626C6.70407 23.3333 5.95717 22.5845 5.9596 21.6623L5.99646 7.66228C5.99887 6.74352 6.74435 6 7.66312 6H24.3333C25.2521 6 25.9975 6.7435 26 7.66224L26.0371 21.6622C26.0396 22.5844 25.2927 23.3333 24.3705 23.3333ZM12.6647 14C12.2965 14 11.998 14.2985 11.998 14.6667V15.3333C11.998 15.7015 12.2965 16 12.6647 16H19.3313C19.6995 16 19.998 15.7015 19.998 15.3333V14.6667C19.998 14.2985 19.6995 14 19.3313 14H12.6647Z"
                  />
                </svg>
                <span className={styles.navLabel}>メッセージ</span>
              </div>
              <div className={styles.navItem} style={{ opacity: 0.75 }}>
                <svg viewBox="0 0 48 48" fill="#fff">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M24.0001 11.5C20.9625 11.5 18.5001 13.9624 18.5001 17C18.5001 20.0376 20.9625 22.5 24.0001 22.5C27.0377 22.5 29.5001 20.0376 29.5001 17C29.5001 13.9624 27.0377 11.5 24.0001 11.5ZM15.5001 17C15.5001 12.3056 19.3057 8.5 24.0001 8.5C28.6945 8.5 32.5001 12.3056 32.5001 17C32.5001 21.6944 28.6945 25.5 24.0001 25.5C19.3057 25.5 15.5001 21.6944 15.5001 17ZM24.0001 30.5C19.1458 30.5 15.0586 33.7954 13.8578 38.2712C13.7147 38.8046 13.2038 39.1741 12.6591 39.0827L11.6729 38.9173C11.1282 38.8259 10.7571 38.3085 10.8888 37.7722C12.3362 31.8748 17.6559 27.5 24.0001 27.5C30.3443 27.5 35.664 31.8748 37.1114 37.7722C37.2431 38.3085 36.872 38.8259 36.3273 38.9173L35.3411 39.0827C34.7964 39.1741 34.2855 38.8046 34.1424 38.2712C32.9416 33.7954 28.8544 30.5 24.0001 30.5Z"
                  />
                </svg>
                <span className={styles.navLabel}>プロフィール</span>
              </div>
            </div>

            <div className={styles.pOv} data-id="floatPreview">
              <div className={styles.pMc}>
                <div className={styles.pMb}>
                  <div className={styles.pMi} data-id="previewIconArea">
                    <span data-id="previewIconPlaceholder">＋</span>
                    <img data-id="previewIconImg" style={{ display: 'none' }} alt="" />
                    <div className={styles.pMiBadge}>変更</div>
                  </div>
                  <p className={styles.pMt}>アプリで全機能をお試しください</p>
                  <p className={styles.pMd}>アプリでさらに多くの動画と優れた機能をお楽しみください</p>
                </div>
                <div className={styles.pMa}>
                  <div className={styles.pBo}>TikTokを開く</div>
                  <div className={styles.pBl}>後で</div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.zoomRow} data-id="zoomRow">
            <span>ズーム</span>
            <input type="range" data-id="zoomSlider" min="1" max="4" step="0.01" defaultValue="1" />
          </div>
          <div className={styles.floatRow}>
            <div className={styles.piLeft}>
              <input type="checkbox" data-id="floatToggle" id="floatToggle" />
              <label htmlFor="floatToggle">誘導ダイアログをプレビュー表示</label>
            </div>
          </div>
          <div className={styles.piRow}>
            <div className={styles.piLeft}>
              <input type="checkbox" data-id="piToggle" id="piToggle" />
              <label htmlFor="piToggle">ページインジケーター(見た目のみ)</label>
            </div>
            <div className={styles.piLeft}>
              <span>個数</span>
              <input type="text" data-id="piCount" defaultValue="3" inputMode="numeric" />
            </div>
          </div>
          <div className={styles.previewHint}>
            背景はドラッグで位置調整・スライダーで拡大縮小、アイコンはタップして画像を選択、数値やテキストはタップして直接入力できます
          </div>
        </div>

        <div className={styles.panel}>
          {restoredFromDraft && (
            <div className={styles.info}>この端末に保存されていた未保存の編集内容を復元しました。</div>
          )}

          <div className={styles.card}>
            <div className={styles.sec}>公開設定</div>
            <div className={styles.field}>
              <label className={styles.fl}>公開URL(slug)</label>
              <input type="text" data-id="slug" placeholder="例: my-name" />
              <div className={styles.hint}>
                半角英小文字・数字・ハイフンのみ。<strong>{siteUrlOrigin}/slug</strong> になります
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.fl}>TikTokプロフィールURL(ボタンの遷移先)</label>
              <input type="url" data-id="tiktokUrl" placeholder="https://www.tiktok.com/@username" />
              <div className={styles.checkRow}>
                <input type="checkbox" data-id="cushionToggle" id="cushionToggle" />
                <label htmlFor="cushionToggle">クッションページを挟む</label>
              </div>
              <div className={styles.hint} data-id="cushionHint" />
            </div>
            <div className={styles.field}>
              <label className={styles.fl}>
                OGPタイトル{' '}
                <span style={{ color: 'rgba(255,255,255,.3)', fontWeight: 400 }}>(SNSシェア時のタイトル)</span>
              </label>
              <input type="text" data-id="ogpTitle" placeholder="例: 俺の動画見て" />
            </div>
            <div className={styles.field}>
              <label className={styles.fl}>OGP画像</label>
              <label className={styles.fileBtn} data-id="ogpLabel">
                <span>タップして選択</span>
              </label>
              <input type="file" data-id="ogpInput" accept="image/*" />
              <div className={styles.ogpWarning} data-id="ogpWarning">
                <p data-id="ogpWarningText" />
                <button type="button" className={styles.ogpCompressBtn} data-id="ogpCompressBtn" style={{ display: 'none' }}>
                  圧縮する
                </button>
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.fl}>
                アプリアイコン画像{' '}
                <span style={{ color: 'rgba(255,255,255,.3)', fontWeight: 400 }}>(誘導ダイアログ用)</span>
              </label>
              <label className={styles.fileBtn} data-id="iconLabel">
                <span>タップして選択</span>
              </label>
              <input type="file" data-id="iconInput" accept="image/*" />
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.missingWarning} data-id="missingWarning" />
            <button type="button" className={styles.btnDeploy} data-id="deployBtn" disabled>
              {saving ? '保存中...' : '公開する'}
            </button>
            <div className={`${styles.status} ${statusMsg.type ? styles[statusMsg.type] : ''}`}>{statusMsg.text}</div>
            <div className={`${styles.result} ${resultUrl ? styles.visible : ''}`}>
              {resultUrl && (
                <>
                  公開URL:{' '}
                  <a href={resultUrl} target="_blank" rel="noreferrer">
                    {resultUrl}
                  </a>
                </>
              )}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.info}>入力内容はこの端末に自動保存され、次回このページを開いたときに復元されます。</div>
          </div>
        </div>
      </div>

      <input type="file" data-id="bgInput" accept="image/*" style={{ display: 'none' }} />
      <input type="file" data-id="avatarInput" accept="image/*" style={{ display: 'none' }} />
    </div>
  );
}
