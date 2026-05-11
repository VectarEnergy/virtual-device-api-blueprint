import axios from 'axios';

import config from '../../config/config';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryableAxiosFailure(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: string; response?: { status?: number } };
  if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT') return true;
  const status = e.response?.status;
  if (status == null) return true;
  return status >= 500 || status === 429;
}

/** GET JSON from Victron VRM with timeout and limited retries (transient network / 5xx). */
export async function vrmGet(
  url: string,
  headers: Record<string, string>,
): Promise<{ data: unknown }> {
  const timeout = config.vrmRequestTimeoutMs;
  const maxAttempts = config.vrmMaxRetries + 1;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await axios.get(url, {
        headers,
        timeout,
        validateStatus: (s) => s >= 200 && s < 300,
      });
    } catch (e) {
      lastErr = e;
      if (!isRetryableAxiosFailure(e) || attempt === maxAttempts) throw e;
      await sleep(750 * attempt);
    }
  }
  throw lastErr;
}
