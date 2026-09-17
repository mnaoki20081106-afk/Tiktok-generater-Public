import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

const MIN_SECRET_LENGTH = 32;

/** IPの生値は保存せず、この秘密鍵を使ったHMACだけをDBに保存する。 */
export function isIpHashingConfigured(): boolean {
  return (process.env.IP_HASH_SECRET ?? '').length >= MIN_SECRET_LENGTH;
}

function stripPort(value: string): string {
  const input = value.trim().replace(/^"|"$/g, '');
  const bracketed = input.match(/^\[([^\]]+)](?::\d+)?$/);
  if (bracketed) return bracketed[1];
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(input)) return input.slice(0, input.lastIndexOf(':'));
  return input;
}

function ipv6Network64(value: string): string | null {
  let input = value.toLowerCase().split('%')[0];
  if (input.startsWith('::ffff:') && isIP(input.slice(7)) === 4) return `ipv4:${input.slice(7)}`;
  if (isIP(input) !== 6) return null;

  // IPv4埋め込み表現を2つのhextetへ変換する。
  const ipv4 = input.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  if (ipv4) {
    const octets = ipv4.split('.').map(Number);
    input = input.slice(0, -ipv4.length)
      + ((octets[0] << 8) | octets[1]).toString(16)
      + ':'
      + ((octets[2] << 8) | octets[3]).toString(16);
  }

  const halves = input.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':').filter(Boolean) : [];
  const right = halves[1] ? halves[1].split(':').filter(Boolean) : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null;
  const full = [...left, ...Array(missing).fill('0'), ...right];
  if (full.length !== 8 || full.some(part => !/^[0-9a-f]{1,4}$/.test(part))) return null;

  // IPv6の一時アドレスが変わっても同じ回線として扱えるよう、/64単位で識別する。
  return `ipv6-64:${full.slice(0, 4).map(part => part.padStart(4, '0')).join(':')}`;
}

export function normalizeClientIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const input = stripPort(raw);
  if (isIP(input) === 4) return `ipv4:${input}`;
  return ipv6Network64(input);
}

/**
 * 直近の信頼済みプロキシが付与した値を優先する。x-forwarded-for は右端を採用し、
 * クライアントが左側へ偽の値を足した場合でも回避しにくくする。
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const direct = [headers.get('cf-connecting-ip'), headers.get('x-real-ip')];
  for (const value of direct) {
    const normalized = normalizeClientIp(value);
    if (normalized) return normalized;
  }

  const forwarded = (headers.get('x-forwarded-for') ?? '').split(',').map(value => value.trim()).filter(Boolean);
  for (let i = forwarded.length - 1; i >= 0; i--) {
    const normalized = normalizeClientIp(forwarded[i]);
    if (normalized) return normalized;
  }
  return null;
}

export function hashClientIp(headers: Headers): string | null {
  const secret = process.env.IP_HASH_SECRET ?? '';
  const normalized = clientIpFromHeaders(headers);
  if (secret.length < MIN_SECRET_LENGTH || !normalized) return null;
  return `v1:${createHmac('sha256', secret).update(normalized).digest('hex')}`;
}
