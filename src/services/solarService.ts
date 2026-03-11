import {
  getSiteState,
  seedSiteCumulative,
  updateSiteState,
} from "../lib/sequelizeAdapter";

import axios from "axios";
import config from "../config/config";

// Use the VRM attribute that returns 15-minute totals/absolute meter values
const VICTRON_ATTR = "total_solar_yield";

// Interval duration in milliseconds
const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the start/end epoch-second range for the last fully completed 15-minute
 * UTC interval.
 * e.g. if now is 14:35 UTC, returns 14:15:00 → 14:29:59 UTC.
 */
const getLastIntervalRangeUtc = (): {
  start: number;
  end: number;
} => {
  const now = new Date();
  const nowMs = now.getTime();
  // Floor to the current 15-minute boundary
  const topOfCurrentInterval = Math.floor(nowMs / INTERVAL_MS) * INTERVAL_MS;
  // Previous full 15-minute window [start, end]
  const startMs = topOfCurrentInterval - INTERVAL_MS; // e.g. 14:15:00.000 UTC
  const endMs = topOfCurrentInterval - 1;              // e.g. 14:29:59.999 UTC
  return {
    start: Math.floor(startMs / 1000),
    end: Math.floor(endMs / 1000),
  };
};

const buildVictronUrlForInterval = (
  siteId: string,
  start: number,
  end: number,
): string => {
  return (
    `${config.victronApiUrl}/installations/${siteId}/stats` +
    `?type=custom&interval=15mins` +
    `&attributeCodes%5B%5D=${encodeURIComponent(VICTRON_ATTR)}` +
    `&start=${start}&end=${end}`
  );
};

/**
 * Parse the records series returned by VRM.
 *
 * `total_solar_yield` is a cumulative meter (odometer), so the energy
 * produced during the window is (last value − first value), not the sum.
 * We also return the raw last datapoint as `absolute` for reference.
 */
const parseSolarSeriesDelta = (
  series: any[],
): { total: number; absolute?: number } => {
  if (!Array.isArray(series) || series.length === 0) return { total: 0 };

  const values: number[] = series
    .map((v) => Number(Array.isArray(v) ? v[v.length - 1] : v))
    .filter((n) => isFinite(n));

  if (values.length === 0) return { total: 0 };

  const first = values[0];
  const last = values[values.length - 1];
  // Delta = energy produced during the window; guard against negative rollover
  const delta = last >= first ? last - first : last;
  return { total: delta, absolute: last };
};

// ---------------------------------------------------------------------------
// Core fetch + store
// ---------------------------------------------------------------------------

/**
 * Fetch VRM stats for an arbitrary [start, end] epoch-second window and
 * persist the result via updateSiteState.
 */
export const fetchAndStoreInterval = async (
  siteId: string,
  start: number,
  end: number,
  token?: string,
): Promise<{
  start: number;
  end: number;
  total: number;
  absolute?: number;
  retrievedAt: string;
}> => {
  if (!config.victronApiUrl) throw new Error("VICTRON_API_URL not configured");

  const url = buildVictronUrlForInterval(siteId, start, end);

  const headers: Record<string, string> = {};
  if (token) headers["x-authorization"] = token;
  else if (config.victronToken)
    headers["x-authorization"] = `Token ${config.victronToken}`;

  const resp = await axios.get(url, { headers });
  const data = (resp.data as any) ?? {};

  console.log(
    `\n[DEBUG] VRM API response for ${new Date(start * 1000).toISOString()} – ${new Date(end * 1000).toISOString()}:`,
  );
  console.dir(data, { depth: 10 });

  // Prefer the pre-summed totals object when VRM provides it
  const totals = data.totals ?? {};
  let total: number;
  let absolute: number | undefined;

  if (typeof totals[VICTRON_ATTR] === "number") {
    total = Number(totals[VICTRON_ATTR]);
  } else {
    // Fallback: derive from raw series using delta (first → last)
    const series = (data.records ?? {})[VICTRON_ATTR] ?? [];
    const parsed = parseSolarSeriesDelta(series);
    total = parsed.total;
    absolute = parsed.absolute;
  }

  total = Number(total || 0);
  const retrievedAt = new Date().toISOString();

  await updateSiteState(siteId, (s) => {
    s.history = s.history || [];

    // Idempotent: if we already stored this window, overwrite without
    // touching cumulative (prevents double-counting on repeated fetches).
    const existingIdx = s.history.findIndex(
      (h: any) => h && h.start === start && h.end === end,
    );

    if (existingIdx >= 0) {
      s.history[existingIdx] = {
        start,
        end,
        value: total,
        retrievedAt,
      };
      s.lastHour = s.history[existingIdx];
      return;
    }

    // New window — add to cumulative once (no rounding at persistence time)
    s.cumulative = Number(s.cumulative || 0) + total;

    const rec: any = {
      start,
      end,
      value: total,
      retrievedAt,
    };
    if (typeof absolute === "number") rec.absolute = absolute;
    rec.vrmTotal = total;

    s.lastHour = rec;
    s.history.push(rec);
  });

  return { start, end, total, absolute, retrievedAt };
};

/**
 * Convenience wrapper — fetches the last fully completed 15-minute UTC interval.
 */
export const fetchAndStoreLastInterval = async (siteId: string, token?: string) => {
  const { start, end } = getLastIntervalRangeUtc();
  return fetchAndStoreInterval(siteId, start, end, token);
};

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

/**
 * Fetch and store every missing completed UTC hour since the most recently
 * stored history record, up to the current last completed 15-minute interval.
 */
export const catchUpMissedIntervals = async (
  siteId: string,
  token?: string,
): Promise<void> => {
  const state = await getSiteState(siteId);
  const history = Array.isArray(state.history) ? state.history : [];

  const latestEnd = history.reduce((maxEnd: number, h: any) => {
    const end = Number(h?.end);
    return Number.isFinite(end) ? Math.max(maxEnd, end) : maxEnd;
  }, 0);

  const { start: lastCompletedStart } = getLastIntervalRangeUtc();

  let nextStart = latestEnd > 0 ? latestEnd + 1 : lastCompletedStart;
  if (nextStart > lastCompletedStart) {
    console.log("[Scheduler] Catch-up not needed (already up to date)");
    return;
  }

  console.log(
    `[Scheduler] Catch-up starting from ${new Date(nextStart * 1000).toISOString()} to ${new Date(lastCompletedStart * 1000).toISOString()}`,
  );

  while (nextStart <= lastCompletedStart) {
    const start = nextStart;
    const end = start + 15 * 60 - 1; // 15-minute window

    try {
      await fetchAndStoreInterval(siteId, start, end, token);
      console.log(
        `[Scheduler] Catch-up fetched ${new Date(start * 1000).toISOString()} – ${new Date(end * 1000).toISOString()}`,
      );
    } catch (err) {
      console.error(
        `[Scheduler] Catch-up error for ${new Date(start * 1000).toISOString()} – ${new Date(end * 1000).toISOString()}:`,
        (err as any)?.message ?? err,
      );
    }

    nextStart = end + 1;
  }

  console.log("[Scheduler] Catch-up complete");
};

/**
 * On startup: run catch-up for missed completed 15-minute intervals, then schedule
 * subsequent fetches at the top of every 15-minute boundary (offset by 5 s to let
 * VRM finalise the previous interval's data).
 *
 * The first scheduled run aligns to the next UTC 15-minute boundary (+5 seconds).
 * After that it fires every 15 minutes.
 */
export const startScheduler = (siteId: string): void => {
  const now = new Date();
  let running = false;

  const run = async (reason: "startup" | "scheduled") => {
    if (running) {
      console.log(
        `[Scheduler] Skipping ${reason} run because previous run is still in progress`,
      );
      return;
    }

    running = true;
    try {
      if (reason === "startup") {
        await catchUpMissedIntervals(siteId);
      } else {
        await fetchAndStoreLastInterval(siteId);
        console.log(
          `[Scheduler] Ran scheduled fetch at ${new Date().toISOString()}`,
        );
      }
    } catch (err) {
      console.error(
        `[Scheduler] Error on ${reason} run:`,
        (err as any)?.message ?? err,
      );
    } finally {
      running = false;
    }
  };

  // Startup run (includes catch-up)
  void run("startup");

  // Next UTC 15-minute boundary + 5 seconds
  const nowMs = now.getTime();
  const next15MinBoundaryMs =
    Math.ceil((nowMs + 1) / INTERVAL_MS) * INTERVAL_MS;
  const nextRunMs = next15MinBoundaryMs + 5_000; // +5 s so VRM has time to finalise

  const delay = nextRunMs - nowMs;
  console.log(
    `[Scheduler] First scheduled run at ${new Date(nextRunMs).toISOString()} (in ${Math.round(delay / 60000)} min)`,
  );

  setTimeout(() => {
    void run("scheduled");
    setInterval(
      () => {
        void run("scheduled");
      },
      INTERVAL_MS, // every 15 minutes
    );
  }, delay);
};

// ---------------------------------------------------------------------------
// Manual backfill
// ---------------------------------------------------------------------------

/**
 * Fetch and store every hour from Monday 06:00 UTC up to the current hour.
 * Useful for backfilling a week's worth of data.
 */
export const fetchFromMonday6amToNow = async (
  siteId: string,
  token?: string,
): Promise<void> => {
  const now = new Date();

  // Most recent Monday at 00:00 UTC
  const monday = new Date(now);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));

  // Iterate from Monday 06:00 UTC to now, one 15-minute interval at a time
  let cursor = new Date(
    Date.UTC(
      monday.getUTCFullYear(),
      monday.getUTCMonth(),
      monday.getUTCDate(),
      6,
      0,
      0,
    ),
  );

  while (cursor <= now) {
    const start = Math.floor(cursor.getTime() / 1000);
    const end = Math.floor((cursor.getTime() + INTERVAL_MS - 1) / 1000);

    console.log(
      `[Manual] Fetching ${new Date(start * 1000).toISOString()} – ${new Date(end * 1000).toISOString()}`,
    );

    await fetchAndStoreInterval(siteId, start, end, token);

    cursor = new Date(cursor.getTime() + INTERVAL_MS);
  }

  console.log("[Manual] Done fetching from Monday 06:00 UTC to now.");
};

// ---------------------------------------------------------------------------
// Reporting / seeding
// ---------------------------------------------------------------------------

/**
 * Returns the stored site state with cumulative recalculated from history
 * to guard against any drift caused by earlier double-counting bugs.
 */
export const getStoredSiteReport = async (siteId: string) => {
  const s = await getSiteState(siteId);
  const history = Array.isArray(s.history) ? s.history : [];
  const cumulative = history.reduce(
    (acc: number, h: any) => acc + (typeof h.value === "number" ? h.value : 0),
    0,
  );
  return { ...s, cumulative };
};

/**
 * Seed an initial cumulative value (e.g. to account for production before
 * this service was deployed).
 */
export const seedInitialCumulative = async (
  siteId: string,
  value: number,
): Promise<void> => {
  await seedSiteCumulative(siteId, value, true);
};
