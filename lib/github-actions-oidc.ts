import { webcrypto } from 'node:crypto';

const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
const DISCOVERY_URL =
  'https://token.actions.githubusercontent.com/.well-known/openid-configuration';

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

export type GitHubActionsOidcClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  repository?: string;
  repository_owner?: string;
  ref?: string;
  workflow_ref?: string;
  event_name?: string;
  sha?: string;
  [key: string]: unknown;
};

type OidcDiscovery = {
  issuer?: string;
  jwks_uri?: string;
};

type JsonWebKeyWithKid = JsonWebKey & {
  kid?: string;
  alg?: string;
  use?: string;
};

type Jwks = {
  keys?: JsonWebKeyWithKid[];
};

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return new Uint8Array(Buffer.from(normalized + padding, 'base64'));
}

function decodeJsonPart<T>(value: string): T {
  const bytes = decodeBase64Url(value);
  return JSON.parse(Buffer.from(bytes).toString('utf8')) as T;
}

function audienceMatches(
  audience: string | string[] | undefined,
  expectedAudience: string,
): boolean {
  return Array.isArray(audience)
    ? audience.includes(expectedAudience)
    : audience === expectedAudience;
}

export async function verifyGitHubActionsOidcToken(
  token: string,
  expectedAudience: string,
): Promise<GitHubActionsOidcClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed GitHub OIDC token');

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonPart<JwtHeader>(encodedHeader);
  const claims = decodeJsonPart<GitHubActionsOidcClaims>(encodedPayload);

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unexpected GitHub OIDC signing algorithm');
  }

  const discoveryResponse = await fetch(DISCOVERY_URL, { cache: 'force-cache' });
  if (!discoveryResponse.ok) {
    throw new Error('GitHub OIDC discovery HTTP ' + discoveryResponse.status);
  }
  const discovery = (await discoveryResponse.json()) as OidcDiscovery;
  if (
    discovery.issuer !== GITHUB_OIDC_ISSUER ||
    !discovery.jwks_uri ||
    !discovery.jwks_uri.startsWith(GITHUB_OIDC_ISSUER + '/')
  ) {
    throw new Error('Unexpected GitHub OIDC discovery document');
  }

  const jwksResponse = await fetch(discovery.jwks_uri, { cache: 'force-cache' });
  if (!jwksResponse.ok) {
    throw new Error('GitHub OIDC JWKS HTTP ' + jwksResponse.status);
  }
  const jwks = (await jwksResponse.json()) as Jwks;
  const jwk = (jwks.keys || []).find(
    (candidate) =>
      candidate.kid === header.kid &&
      candidate.kty === 'RSA' &&
      (!candidate.alg || candidate.alg === 'RS256'),
  );
  if (!jwk) throw new Error('GitHub OIDC signing key not found');

  const key = await webcrypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const signedBytes = new TextEncoder().encode(
    encodedHeader + '.' + encodedPayload,
  );
  const signature = decodeBase64Url(encodedSignature);
  const validSignature = await webcrypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature,
    signedBytes,
  );
  if (!validSignature) throw new Error('Invalid GitHub OIDC signature');

  const now = Math.floor(Date.now() / 1000);
  const clockSkewSeconds = 60;
  if (claims.iss !== GITHUB_OIDC_ISSUER) {
    throw new Error('Unexpected GitHub OIDC issuer');
  }
  if (!audienceMatches(claims.aud, expectedAudience)) {
    throw new Error('Unexpected GitHub OIDC audience');
  }
  if (typeof claims.exp !== 'number' || claims.exp < now - clockSkewSeconds) {
    throw new Error('Expired GitHub OIDC token');
  }
  if (typeof claims.nbf === 'number' && claims.nbf > now + clockSkewSeconds) {
    throw new Error('GitHub OIDC token is not active yet');
  }

  return claims;
}

export function assertXMonitorWorkflowClaims(
  claims: GitHubActionsOidcClaims,
): void {
  const expectedWorkflowRef =
    'mnaoki20081106-afk/X-Bunseki/.github/workflows/monitor.yml@refs/heads/main';

  if (claims.repository !== 'mnaoki20081106-afk/X-Bunseki') {
    throw new Error('Unexpected GitHub repository');
  }
  if (claims.ref !== 'refs/heads/main') {
    throw new Error('Unexpected GitHub ref');
  }
  if (claims.workflow_ref !== expectedWorkflowRef) {
    throw new Error('Unexpected GitHub workflow');
  }
  if (
    claims.event_name !== 'schedule' &&
    claims.event_name !== 'workflow_dispatch' &&
    claims.event_name !== 'push'
  ) {
    throw new Error('Unexpected GitHub workflow event');
  }
}
