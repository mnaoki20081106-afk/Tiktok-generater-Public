/**
 * 生成したURLをコピーするためのユーティリティ。
 * 単独版 index.html のコピー処理をそのまま移植したもの(iOS Safari対応の都合で
 * navigator.clipboard だけでは足りないため、execCommand版のフォールバックを残している)。
 */

/* iOS Safari は textarea.select() では execCommand に選択範囲が渡らない。
   Range で選択し、キーボードが出ないよう readonly を併用する。 */
function legacyCopy(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.contentEditable = 'true';
  ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:none;opacity:0';
  document.body.appendChild(ta);

  let ok = false;
  try {
    const range = document.createRange();
    range.selectNodeContents(ta);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    ta.setSelectionRange(0, 999999);
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => legacyCopy(text) // 権限拒否時は従来方式へ
    );
  }
  return Promise.resolve(legacyCopy(text));
}

/* コピーできなかったときの最終手段。長押し→コピー ができるよう選択しておく。 */
export function selectElementText(el: Element): void {
  try {
    const r = document.createRange();
    r.selectNodeContents(el);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
  } catch {
    /* noop */
  }
}
