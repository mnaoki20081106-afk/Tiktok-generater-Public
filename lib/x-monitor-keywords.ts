export type XKeywordKind = 'keywords' | 'combo' | 'ng';

export function parseXKeywordValues(kind: XKeywordKind, text: string): string[] {
  const values: string[] = [];
  const seen = new Set<string>();

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    // X-Bunseki intentionally treats "# " as a comment but allows hashtag
    // keywords such as "#PR".
    if (!line || line === '#' || line.startsWith('# ')) continue;

    const parts = kind === 'combo' ? [line] : line.split(/[,、]/);
    for (const item of parts) {
      const value = item.trim();
      if (value && !seen.has(value)) {
        seen.add(value);
        values.push(value);
      }
    }
  }

  return values;
}

export function applyXKeywordChanges(
  kind: XKeywordKind,
  originalText: string,
  additions: string[],
  removals: string[],
): string {
  const removeSet = new Set(removals);
  const existing = new Set<string>();
  const output: string[] = [];

  for (const raw of originalText.split(/\r?\n/)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '#' || trimmed.startsWith('# ')) {
      output.push(raw);
      continue;
    }

    if (kind === 'combo') {
      if (!removeSet.has(trimmed)) {
        output.push(raw);
        existing.add(trimmed);
      }
      continue;
    }

    const separator = raw.includes('、') ? '、' : ', ';
    const kept = raw
      .split(/[,、]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item) => !removeSet.has(item));

    kept.forEach((item) => existing.add(item));
    if (kept.length) output.push(kept.join(separator));
  }

  const append = additions.filter(
    (item) => !existing.has(item) && !removeSet.has(item),
  );

  if (append.length) {
    while (output.length && !output[output.length - 1].trim()) output.pop();
    output.push('', '# Added from parent Web admin');
    output.push(...append);
  }

  return `${output.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}
