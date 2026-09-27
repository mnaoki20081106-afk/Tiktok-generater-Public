import { NextRequest, NextResponse } from 'next/server';
import {
  assertXMonitorWorkflowClaims,
  verifyGitHubActionsOidcToken,
} from '@/lib/github-actions-oidc';
import { savePrivateXMonitorSnapshot } from '@/lib/x-monitor-private-source';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const AUDIENCE = 'https://post-link.net/api/internal/x-monitor-sync';
const MAX_BODY_CHARS = 2_000_000;

function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function POST(request: NextRequest) {
  const token = bearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const claims = await verifyGitHubActionsOidcToken(token, AUDIENCE);
    assertXMonitorWorkflowClaims(claims);

    const bodyText = await request.text();
    if (bodyText.length > MAX_BODY_CHARS) {
      return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
    }

    const body = JSON.parse(bodyText) as {
      hits?: unknown;
      status?: unknown;
      model_registry?: unknown;
      impression_model?: unknown;
    };

    await savePrivateXMonitorSnapshot({
      sourceSha: typeof claims.sha === 'string' ? claims.sha : null,
      hits: body.hits,
      status: body.status,
      modelRegistry: body.model_registry,
      impressionModel: body.impression_model,
    });

    return new NextResponse(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[x-monitor-sync] rejected', error);
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}
