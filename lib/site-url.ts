export const PRODUCTION_SITE_ORIGIN = 'https://post-link.net';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/**
 * Canonical origin used for public metadata and generated public-page URLs.
 *
 * Production is intentionally pinned to post-link.net so a stale Vercel
 * NEXT_PUBLIC_SITE_URL value or deployment hostname cannot leak the previous
 * public domain into OGP/canonical-style URLs.
 */
export function resolvePublicSiteOrigin(fallbackUrl?: string): string {
  if (
    process.env.VERCEL_ENV === 'production' ||
    (!process.env.VERCEL_ENV && process.env.NODE_ENV === 'production')
  ) {
    return PRODUCTION_SITE_ORIGIN;
  }

  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return trimTrailingSlash(new URL(explicit).origin);
  }

  if (fallbackUrl) {
    return new URL(fallbackUrl).origin;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return 'http://localhost:3000';
}

export function resolveMetadataBase(): URL {
  return new URL(resolvePublicSiteOrigin());
}
