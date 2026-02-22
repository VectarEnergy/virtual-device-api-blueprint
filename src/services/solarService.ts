import { getSiteState, seedSiteCumulative, updateSiteState } from '../lib/sequelizeAdapter';

import axios from 'axios';
import config from '../config/config';

const VICTRON_ATTR = 'solar_yield';

const getLastHourRangeUtc = () => {
  const now = new Date();
  // compute previous full hour range in UTC
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDate = now.getUTCDate();
  const utcHour = now.getUTCHours();
  const end = Date.UTC(utcYear, utcMonth, utcDate, utcHour, 0, 0) - 1; // end of previous hour
  const start = end - 60 * 60 * 1000 + 1; // start of previous hour
  return { start: Math.floor(start / 1000), end: Math.floor(end / 1000) };
};

const buildVictronUrlForHour = (siteId: string, start: number, end: number) => {
  // preserve attributeCodes[] encoding as requested
  return `${config.victronApiUrl}/installations/${siteId}/stats?type=custom&interval=15mins&attributeCodes%5B%5D=${encodeURIComponent(VICTRON_ATTR)}&start=${start}&end=${end}`;
};

const parseSolarSeriesDelta = (series: any[]): number => {
  // series expected like [[ts, value], ...] or [[ts, avg, min, max], ...]
  if (!Array.isArray(series) || series.length === 0) return 0;
  const first = series[0];
  const last = series[series.length - 1];
  const firstVal = Array.isArray(first) ? Number(first[first.length - 1]) : Number(first);
  const lastVal = Array.isArray(last) ? Number(last[last.length - 1]) : Number(last);
  if (!isFinite(firstVal) || !isFinite(lastVal)) {
    // fallback: sum values
    const summed = series.reduce((acc: number, v: any) => {
      const val = Array.isArray(v) ? Number(v[v.length - 1]) : Number(v);
      return acc + (isFinite(val) ? val : 0);
    }, 0);
    return summed;
  }
  const delta = lastVal - firstVal;
  return delta >= 0 ? delta : 0;
};

export const fetchAndStoreLastHour = async (siteId: string, token?: string) => {
  if (!config.victronApiUrl) throw new Error('VICTRON_API_URL not configured');
  const { start, end } = getLastHourRangeUtc();
  const url = buildVictronUrlForHour(siteId, start, end);
  const headers: Record<string, string> = {};
  if (token) headers['x-authorization'] = token;
  else if (config.victronToken) headers['x-authorization'] = `Token ${config.victronToken}`;

  const resp = await axios.get(url, { headers });
  const records = (resp.data as any)?.records ?? {};
  const series = records[VICTRON_ATTR] || [];
  const delta = parseSolarSeriesDelta(series);

  const retrievedAt = new Date().toISOString();

  await updateSiteState(siteId, (s) => {
    s.cumulative = Number((s.cumulative + delta).toFixed(6)); // keep more precision in store
    const rec = { start, end, value: Number(delta.toFixed(6)), retrievedAt };
    s.lastHour = rec;
    s.history = s.history || [];
    s.history.push(rec);
  });

  return { start, end, delta, retrievedAt };
};

// Scheduler: start at next top-of-hour UTC, then run every hour
export const startScheduler = (siteId: string) => {
  const now = new Date();
  const nextHour = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + 1, 0, 5));
  const delay = nextHour.getTime() - now.getTime();
  setTimeout(() => {
    // run first then every hour
    (async () => {
      try {
        await fetchAndStoreLastHour(siteId);
      } catch (err) {
        // log and continue
        // eslint-disable-next-line no-console
        console.error('solar scheduler error', (err as any)?.message || err);
      }
    })();
    setInterval(async () => {
      try {
        await fetchAndStoreLastHour(siteId);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('solar scheduler error', (err as any)?.message || err);
      }
    }, 60 * 60 * 1000);
  }, delay);
};

export const getStoredSiteReport = async (siteId: string) => {
  const s = await getSiteState(siteId);
  return s;
};

export const seedInitialCumulative = async (siteId: string, value: number) => {
  await seedSiteCumulative(siteId, value, true);
};
