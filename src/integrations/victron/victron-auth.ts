import config from '../../config/config';

/**
 * `x-authorization` for VRM stats. `tokenOverride` is a raw token or full `Token …` string
 * (e.g. from `x-authorization` on a request).
 */
export function buildVictronAuthHeaders(tokenOverride?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const raw = tokenOverride ?? config.victronToken;
  if (!raw) return headers;
  headers['x-authorization'] = raw.startsWith('Token ') ? raw : `Token ${raw}`;
  return headers;
}
