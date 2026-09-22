import 'server-only';
import {
  applyXKeywordChanges,
  parseXKeywordValues,
  type XKeywordKind,
} from '@/lib/x-monitor-keywords';

export type { XKeywordKind } from '@/lib/x-monitor-keywords';

const ENGINE_REPO = 'mnaoki20081106-afk/X-Bunseki';
const ENGINE_BRANCH = 'main';
const FILES: Record<XKeywordKind, string> = {
  keywords: 'keywords.txt',
  combo: 'keywords_combo.txt',
  ng: 'keywords_ng.txt',
};

export interface XKeywordFile {
  kind: XKeywordKind;
  path: string;
  sha: string;
  text: string;
  values: string[];
}

function githubHeaders(write = false): HeadersInit {
  const token = process.env.X_BUNSEKI_GITHUB_TOKEN?.trim();
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Tiktok-generater-Public/x-monitor-admin',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(write ? { 'Content-Type': 'application/json' } : {}),
  };
}

function decodeBase64(value: string): string {
  return Buffer.from(value.replace(/\n/g, ''), 'base64').toString('utf8');
}

async function readKeywordFile(kind: XKeywordKind): Promise<XKeywordFile> {
  const path = FILES[kind];
  const response = await fetch(
    `https://api.github.com/repos/${ENGINE_REPO}/contents/${path}?ref=${ENGINE_BRANCH}`,
    { cache: 'no-store', headers: githubHeaders() },
  );
  if (!response.ok) {
    throw new Error(`X-Bunseki ${path} の取得に失敗しました (HTTP ${response.status})`);
  }
  const body = (await response.json()) as {
    sha?: string;
    content?: string;
    encoding?: string;
  };
  if (!body.sha || body.encoding !== 'base64' || typeof body.content !== 'string') {
    throw new Error(`X-Bunseki ${path} の応答形式が不正です`);
  }
  const text = decodeBase64(body.content);
  return { kind, path, sha: body.sha, text, values: parseXKeywordValues(kind, text) };
}

export type XKeywordConfig = Record<XKeywordKind, XKeywordFile>;

export async function getXKeywordConfig(): Promise<XKeywordConfig> {
  const [keywords, combo, ng] = await Promise.all([
    readKeywordFile('keywords'),
    readKeywordFile('combo'),
    readKeywordFile('ng'),
  ]);
  return { keywords, combo, ng };
}

export function isXKeywordWriteConfigured(): boolean {
  return Boolean(process.env.X_BUNSEKI_GITHUB_TOKEN?.trim());
}

async function writeKeywordFile(
  file: XKeywordFile,
  text: string,
): Promise<void> {
  const token = process.env.X_BUNSEKI_GITHUB_TOKEN?.trim();
  if (!token) {
    throw new Error('X_BUNSEKI_GITHUB_TOKEN が本番環境に設定されていません');
  }

  const response = await fetch(
    `https://api.github.com/repos/${ENGINE_REPO}/contents/${file.path}`,
    {
      method: 'PUT',
      cache: 'no-store',
      headers: githubHeaders(true),
      body: JSON.stringify({
        message: `config(x-monitor): update ${file.path} from parent admin`,
        branch: ENGINE_BRANCH,
        sha: file.sha,
        content: Buffer.from(text, 'utf8').toString('base64'),
      }),
    },
  );

  if (!response.ok) {
    const safeMessage =
      response.status === 409
        ? 'キーワードが同時更新されました'
        : `GitHub更新に失敗しました (HTTP ${response.status})`;
    throw new Error(safeMessage);
  }
}

export async function updateXKeywords(
  kind: XKeywordKind,
  additions: string[],
  removals: string[],
): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const file = await readKeywordFile(kind);
    const next = applyXKeywordChanges(kind, file.text, additions, removals);
    if (next === file.text) return;
    try {
      await writeKeywordFile(file, next);
      return;
    } catch (error) {
      if (attempt === 0 && error instanceof Error && error.message.includes('同時更新')) {
        continue;
      }
      throw error;
    }
  }
}
