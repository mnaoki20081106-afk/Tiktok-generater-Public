import { createAdminClient } from '@/lib/supabase/admin';

const PRIVATE_BUCKET = 'app-private';
const ALLOWLIST_PATH = 'x-monitor/allowlist.json';

export type XMonitorAllowlist = {
  emails: string[];
  updatedAt: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isMissingObjectError(error: { message?: string; statusCode?: string | number } | null): boolean {
  if (!error) return false;
  const status = Number(error.statusCode || 0);
  const message = String(error.message || '').toLowerCase();
  return status === 404 || message.includes('not found') || message.includes('object not found');
}

async function ensurePrivateBucket() {
  const admin = createAdminClient();
  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) throw listError;

  if (!(buckets || []).some((bucket) => bucket.name === PRIVATE_BUCKET)) {
    const { error: createError } = await admin.storage.createBucket(PRIVATE_BUCKET, {
      public: false,
      fileSizeLimit: 1024 * 1024,
    });
    if (createError && !String(createError.message || '').toLowerCase().includes('already')) {
      throw createError;
    }
  }

  return admin;
}

export async function getXMonitorAllowlist(): Promise<XMonitorAllowlist> {
  const admin = await ensurePrivateBucket();
  const { data, error } = await admin.storage
    .from(PRIVATE_BUCKET)
    .download(ALLOWLIST_PATH);

  if (error) {
    if (isMissingObjectError(error)) {
      return { emails: [], updatedAt: null };
    }
    throw error;
  }

  const raw = JSON.parse(await data.text()) as {
    emails?: unknown;
    updated_at?: unknown;
  };
  const emails = Array.isArray(raw.emails)
    ? [...new Set(raw.emails
      .filter((value): value is string => typeof value === 'string')
      .map(normalizeEmail)
      .filter(Boolean))]
      .sort()
    : [];

  return {
    emails,
    updatedAt: typeof raw.updated_at === 'string' ? raw.updated_at : null,
  };
}

export async function setXMonitorAllowlist(emails: string[]): Promise<XMonitorAllowlist> {
  const normalized = [...new Set(emails.map(normalizeEmail).filter(Boolean))].sort();
  const updatedAt = new Date().toISOString();
  const admin = await ensurePrivateBucket();
  const payload = JSON.stringify(
    { emails: normalized, updated_at: updatedAt },
    null,
    2,
  );

  const { error } = await admin.storage
    .from(PRIVATE_BUCKET)
    .upload(ALLOWLIST_PATH, Buffer.from(payload, 'utf8'), {
      contentType: 'application/json; charset=utf-8',
      upsert: true,
      cacheControl: '0',
    });

  if (error) throw error;
  return { emails: normalized, updatedAt };
}

export async function addXMonitorAllowedEmail(email: string): Promise<XMonitorAllowlist> {
  const current = await getXMonitorAllowlist();
  return setXMonitorAllowlist([...current.emails, normalizeEmail(email)]);
}

export async function removeXMonitorAllowedEmail(email: string): Promise<XMonitorAllowlist> {
  const target = normalizeEmail(email);
  const current = await getXMonitorAllowlist();
  return setXMonitorAllowlist(current.emails.filter((item) => item !== target));
}

export async function isXMonitorEmailAllowlisted(email: string): Promise<boolean> {
  const target = normalizeEmail(email);
  if (!target) return false;
  const current = await getXMonitorAllowlist();
  return current.emails.includes(target);
}
