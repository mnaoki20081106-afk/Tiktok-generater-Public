import { createAdminClient } from '@/lib/supabase/admin';

const PRIVATE_BUCKET = 'app-private';
const SNAPSHOT_PATH = 'x-monitor/latest.json';

export type PrivateXMonitorSnapshot = {
  received_at: string;
  source_sha: string | null;
  hits: Record<string, unknown>;
  status: Record<string, unknown>;
  model_registry: Record<string, unknown>;
  impression_model: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function ensurePrivateBucket() {
  const admin = createAdminClient();
  const { data: buckets, error: listError } = await admin.storage.listBuckets();
  if (listError) throw listError;

  if (!(buckets || []).some((bucket) => bucket.name === PRIVATE_BUCKET)) {
    const { error: createError } = await admin.storage.createBucket(PRIVATE_BUCKET, {
      public: false,
      fileSizeLimit: 2 * 1024 * 1024,
    });
    if (
      createError &&
      !String(createError.message || '').toLowerCase().includes('already')
    ) {
      throw createError;
    }
  }
  return admin;
}

export async function savePrivateXMonitorSnapshot(input: {
  sourceSha: string | null;
  hits: unknown;
  status: unknown;
  modelRegistry: unknown;
  impressionModel: unknown;
}): Promise<void> {
  const admin = await ensurePrivateBucket();
  const payload: PrivateXMonitorSnapshot = {
    received_at: new Date().toISOString(),
    source_sha: input.sourceSha,
    hits: asRecord(input.hits),
    status: asRecord(input.status),
    model_registry: asRecord(input.modelRegistry),
    impression_model: asRecord(input.impressionModel),
  };

  const { error } = await admin.storage
    .from(PRIVATE_BUCKET)
    .upload(
      SNAPSHOT_PATH,
      Buffer.from(JSON.stringify(payload), 'utf8'),
      {
        contentType: 'application/json; charset=utf-8',
        upsert: true,
        cacheControl: '0',
      },
    );
  if (error) throw error;
}

export async function getPrivateXMonitorSnapshot(): Promise<PrivateXMonitorSnapshot> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(PRIVATE_BUCKET)
    .download(SNAPSHOT_PATH);
  if (error) throw error;

  const raw = JSON.parse(await data.text()) as Partial<PrivateXMonitorSnapshot>;
  return {
    received_at: typeof raw.received_at === 'string' ? raw.received_at : '',
    source_sha: typeof raw.source_sha === 'string' ? raw.source_sha : null,
    hits: asRecord(raw.hits),
    status: asRecord(raw.status),
    model_registry: asRecord(raw.model_registry),
    impression_model: asRecord(raw.impression_model),
  };
}
