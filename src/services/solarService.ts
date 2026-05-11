import {
  getSiteState,
  seedSiteCumulative,
  updateSiteState,
} from "../persistence/site-store";

import config from "../config/config";
import { logger } from "../common/logging/logger";
import { getLastCompleted15MinRangeUtcSeconds } from "../domain/solar-intervals";
import { historyOverlaps, parseSolarSeriesDelta } from "../domain/solar-yield-math";
import { buildVictronAuthHeaders } from "../integrations/victron/victron-auth";
import { vrmGet } from "../integrations/victron/vrm-client";

// Use the VRM attribute that returns 15-minute totals/absolute meter values
const VICTRON_ATTR = "total_solar_yield";

// Interval duration in milliseconds
const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** VRM `interval=` for /stats. Catch-up uses `days` or `months`; live polls use `15mins`. */
export type VrmStatsInterval = "15mins" | "days" | "months";

const buildVictronUrlForInterval = (
  siteId: string,
  start: number,
  end: number,
  vrmInterval: VrmStatsInterval = "15mins",
): string => {
  return (
    `${config.victronApiUrl}/installations/${siteId}/stats` +
    `?type=custom&interval=${encodeURIComponent(vrmInterval)}` +
    `&attributeCodes%5B%5D=${encodeURIComponent(VICTRON_ATTR)}` +
    `&start=${start}&end=${end}`
  );
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
  opts?: { vrmInterval?: VrmStatsInterval },
): Promise<{
  start: number;
  end: number;
  total: number;
  absolute?: number;
  retrievedAt: string;
}> => {
  if (!config.victronApiUrl) throw new Error("VICTRON_API_URL not configured");

  const vrmInterval = opts?.vrmInterval ?? "15mins";
  const url = buildVictronUrlForInterval(siteId, start, end, vrmInterval);

  const headers = buildVictronAuthHeaders(token);

  const resp = await vrmGet(url, headers);
  const data = (resp.data as any) ?? {};

  if (process.env.VRM_DEBUG === "1") {
    // eslint-disable-next-line no-console
    console.log(
      `\n[DEBUG] VRM API response for ${new Date(start * 1000).toISOString()} – ${new Date(end * 1000).toISOString()}:`,
    );
    // eslint-disable-next-line no-console
    console.dir(data, { depth: 10 });
  }

  // Prefer the pre-summed totals object when VRM provides it
  const totals = data.totals ?? {};
  let total: number;
  let absolute: number | undefined;

  if (typeof totals[VICTRON_ATTR] === "number") {
    total = Number(totals[VICTRON_ATTR]);
  } else {
    // Fallback: derive from raw series using delta (first → last)
    const series = (data.records ?? {})[VICTRON_ATTR] ?? [];
    const parsed = parseSolarSeriesDelta(series as unknown[]);
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
        vrmInterval,
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
      vrmInterval,
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
  const { start, end } = getLastCompleted15MinRangeUtcSeconds();
  return fetchAndStoreInterval(siteId, start, end, token);
};

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

const INTERVAL_SEC = 15 * 60;
const DAY_SEC = 86400;

function floorDayUtc(sec: number): number {
  const d = new Date(sec * 1000);
  return Math.floor(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0) /
      1000,
  );
}

function monthStartUtc(sec: number): number {
  const d = new Date(sec * 1000);
  return Math.floor(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0) / 1000,
  );
}

function monthEndUtcFromStart(monthStart: number): number {
  const d = new Date(monthStart * 1000);
  return (
    Math.floor(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0) / 1000,
    ) - 1
  );
}

/**
 * Ensure data through the latest fully completed 15m slot is stored.
 *
 * If `TRACKING_START_UTC` is set: backfill with **one VRM request per UTC day**
 * or **per UTC month** (`CATCHUP_VRM_INTERVAL`, default `days`). Skips windows
 * that overlap existing `history`. Scheduled runs still fetch **15m** slices.
 *
 * If `TRACKING_START_UTC` is unset: legacy — forward-fill with15m steps only.
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

  const { start: lastCompletedStart } = getLastCompleted15MinRangeUtcSeconds();
  const fetchSince = config.trackingStartUtcSec;

  if (fetchSince != null) {
    if (fetchSince > lastCompletedStart) {
      console.log(
        "[Scheduler] TRACKING_START_UTC is after last completed interval; nothing to do.",
      );
      return;
    }

    const refEnd = lastCompletedStart + INTERVAL_SEC - 1;
    const mode = config.catchUpVrmInterval;
    const vrmInterval: VrmStatsInterval =
      mode === "months" ? "months" : "days";

    console.log(
      `[Scheduler] Catch-up [${vrmInterval}] ${new Date(fetchSince * 1000).toISOString()} → ${new Date(lastCompletedStart * 1000).toISOString()} (set CATCHUP_VRM_INTERVAL=days|months)`,
    );

    let cursor = fetchSince;
    let skipped = 0;
    let fetched = 0;

    while (cursor <= lastCompletedStart) {
      let start: number;
      let end: number;

      if (mode === "months") {
        const ms = monthStartUtc(cursor);
        start = Math.max(ms, cursor, fetchSince);
        end = Math.min(monthEndUtcFromStart(ms), refEnd);
      } else {
        const day0 = floorDayUtc(cursor);
        start = Math.max(day0, cursor, fetchSince);
        end = Math.min(day0 + DAY_SEC - 1, refEnd);
      }

      end = Math.min(end, refEnd);
      if (start > lastCompletedStart || start > end) {
        break;
      }

      if (historyOverlaps(history, start, end)) {
        skipped++;
      } else {
        try {
          await fetchAndStoreInterval(siteId, start, end, token, {
            vrmInterval,
          });
          fetched++;
          console.log(
            `[Scheduler] Catch-up [${vrmInterval}] ${new Date(start * 1000).toISOString()} – ${new Date(end * 1000).toISOString()}`,
          );
        } catch (err) {
          console.error(
            `[Scheduler] Catch-up error [${vrmInterval}] ${new Date(start * 1000).toISOString()} – ${new Date(end * 1000).toISOString()}:`,
            (err as any)?.message ?? err,
          );
        }
      }

      if (mode === "months") {
        cursor = monthEndUtcFromStart(monthStartUtc(start)) + 1;
      } else {
        cursor = end + 1;
      }
    }

    console.log(
      `[Scheduler] Catch-up complete (fetched ${fetched}, skipped ${skipped} overlapping)`,
    );
    return;
  }

  let nextStart: number;
  if (latestEnd > 0) {
    nextStart = latestEnd + 1;
  } else {
    nextStart = lastCompletedStart;
    // eslint-disable-next-line no-console
    console.warn(
      "[Scheduler] TRACKING_START_UTC is unset — only the latest completed 15m slot is fetched. Set TRACKING_START_UTC (ISO) to backfill from your real start date.",
    );
  }

  if (nextStart > lastCompletedStart) {
    console.log("[Scheduler] Catch-up not needed (already up to date)");
    return;
  }

  console.log(
    `[Scheduler] Catch-up starting from ${new Date(nextStart * 1000).toISOString()} to ${new Date(lastCompletedStart * 1000).toISOString()}`,
  );

  while (nextStart <= lastCompletedStart) {
    const start = nextStart;
    const end = start + INTERVAL_SEC - 1;

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
export type SchedulerHandle = { stop: () => void };

export const startScheduler = (siteId: string): SchedulerHandle => {
  const now = new Date();
  let running = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let intervalId: ReturnType<typeof setInterval> | undefined;

  const run = async (reason: "startup" | "scheduled") => {
    if (running) {
      logger.warn("scheduler.audit", {
        event: "scheduler_skip_concurrent",
        siteId,
        reason,
      });
      return;
    }

    running = true;
    const t0 = Date.now();
    try {
      if (reason === "startup") {
        await catchUpMissedIntervals(siteId);
        logger.info("scheduler.audit", {
          event: "scheduler_startup_catchup",
          siteId,
          ok: true,
          durationMs: Date.now() - t0,
        });
      } else {
        const r = await fetchAndStoreLastInterval(siteId);
        logger.info("scheduler.audit", {
          event: "scheduler_scheduled_fetch",
          siteId,
          ok: true,
          durationMs: Date.now() - t0,
          intervalStartSec: r.start,
          intervalEndSec: r.end,
          kwh: r.total,
        });
      }
    } catch (err) {
      logger.error("scheduler.audit", {
        event:
          reason === "startup"
            ? "scheduler_startup_catchup"
            : "scheduler_scheduled_fetch",
        siteId,
        ok: false,
        durationMs: Date.now() - t0,
        error: (err as Error)?.message ?? String(err),
      });
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
  logger.info("scheduler.audit", {
    event: "scheduler_timers_armed",
    siteId,
    firstRunAt: new Date(nextRunMs).toISOString(),
    delayMs: delay,
  });

  timeoutId = setTimeout(() => {
    void run("scheduled");
    intervalId = setInterval(
      () => {
        void run("scheduled");
      },
      INTERVAL_MS, // every 15 minutes
    );
  }, delay);

  return {
    stop: () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (intervalId !== undefined) clearInterval(intervalId);
    },
  };
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
 * Returns the stored site state with cumulative = sum(history) only
 * (energy from TRACKING_START_UTC through stored intervals).
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

/** Exact integrity check vs VRM for the same [start,end] as stored history (epoch seconds). */
export type SolarYieldReconciliation = {
  siteId: string;
  history_start_epoch_sec: number;
  history_end_epoch_sec: number;
  history_entries: number;
  db_sum_history_kwh: number;
  /** VRM `totals.total_solar_yield` when numeric (may differ from odometer delta). */
  vrm_totals_field_kwh: number | null;
  /** Canonical for cumulative meter: last(series) − first(series). */
  vrm_odometer_delta_kwh: number;
  vrm_first_reading: number | null;
  vrm_last_reading: number | null;
  vrm_series_points: number;
  vrm_interval_used: VrmStatsInterval;
  drift_db_minus_odometer_delta_kwh: number;
  drift_db_minus_totals_kwh: number | null;
};

/**
 * Data integrity: compare `sum(history.value)` to VRM for **exactly** the DB’s
 * min(history.start) … max(history.end) using the same epoch seconds in one stats call.
 *
 * **Canonical** production for `total_solar_yield` is the **odometer delta**
 * (last − first sample), not necessarily `totals` and not necessarily `sum(history)`
 * if history mixes overlapping or differently defined windows.
 */
export const reconcileSolarYieldWithVrm = async (
  siteId: string,
  opts?: { vrmInterval?: VrmStatsInterval; token?: string },
): Promise<SolarYieldReconciliation> => {
  if (!config.victronApiUrl) throw new Error("VICTRON_API_URL not configured");

  const vrmInterval = opts?.vrmInterval ?? "days";
  const state = await getSiteState(siteId);
  const history = Array.isArray(state.history) ? state.history : [];
  if (history.length === 0) {
    throw new Error("No history rows to reconcile");
  }

  const starts = history
    .map((h: any) => Number(h?.start))
    .filter((n: number) => Number.isFinite(n));
  const ends = history
    .map((h: any) => Number(h?.end))
    .filter((n: number) => Number.isFinite(n));
  const minStart = Math.min(...starts);
  const maxEnd = Math.max(...ends);

  const dbSum = history.reduce(
    (acc: number, h: any) => acc + (typeof h.value === "number" ? h.value : 0),
    0,
  );

  const url = buildVictronUrlForInterval(siteId, minStart, maxEnd, vrmInterval);
  const headers = buildVictronAuthHeaders(opts?.token);

  const resp = await vrmGet(url, headers);
  const data = (resp.data as any) ?? {};
  const series = (data.records ?? {})[VICTRON_ATTR] ?? [];
  const parsed = parseSolarSeriesDelta(series as unknown[]);
  const totals = data.totals ?? {};
  const totalsNum =
    typeof totals[VICTRON_ATTR] === "number"
      ? Number(totals[VICTRON_ATTR])
      : null;

  const values: number[] = series
    .map((v: any) => Number(Array.isArray(v) ? v[v.length - 1] : v))
    .filter((n: number) => isFinite(n));

  return {
    siteId,
    history_start_epoch_sec: minStart,
    history_end_epoch_sec: maxEnd,
    history_entries: history.length,
    db_sum_history_kwh: dbSum,
    vrm_totals_field_kwh: totalsNum,
    vrm_odometer_delta_kwh: parsed.total,
    vrm_first_reading: values.length ? values[0] : null,
    vrm_last_reading: values.length ? values[values.length - 1] : null,
    vrm_series_points: Array.isArray(series) ? series.length : 0,
    vrm_interval_used: vrmInterval,
    drift_db_minus_odometer_delta_kwh: dbSum - parsed.total,
    drift_db_minus_totals_kwh:
      totalsNum != null ? dbSum - totalsNum : null,
  };
};

export type DailyRebuildSummary = {
  entries: number;
  totalKwh: number;
  rangeStartEpochSec: number;
  rangeEndEpochSec: number;
  vrm_odometer_delta_kwh: number;
  sum_matches_odometer_delta: boolean;
};

/**
 * **Destructive:** replaces `history` with one row per UTC day from VRM
 * `interval=days`. Each row: `start` = day boundary (epoch s), `end` = next
 * boundary − 1, `value` = odometer(next) − odometer(current) (same physics as
 * `parseSolarSeriesDelta` on consecutive samples).
 *
 * Range: **UTC midnight on/before `TRACKING_START_UTC`** through the same
 * `refEnd` as catch-up (last completed 15m slot). If your tracking start is not
 * midnight, the first included day is the **whole** UTC day containing that
 * instant (logged).
 *
 * After rebuild, `sum(history.value)` should match the odometer delta over the
 * series (within float noise) if VRM returns consecutive daily points.
 */
export const rebuildSiteHistoryDailyFromVrm = async (
  siteId: string,
  opts?: { token?: string },
): Promise<DailyRebuildSummary> => {
  const fetchSinceRaw = config.trackingStartUtcSec;
  if (fetchSinceRaw == null) {
    throw new Error("Set TRACKING_START_UTC");
  }
  if (!config.victronApiUrl) throw new Error("VICTRON_API_URL not configured");

  const { start: lastCompletedStart } = getLastCompleted15MinRangeUtcSeconds();
  const refEnd = lastCompletedStart + INTERVAL_SEC - 1;
  const startDay = floorDayUtc(fetchSinceRaw);

  if (startDay > lastCompletedStart) {
    throw new Error("TRACKING_START_UTC is after last completed interval");
  }

  if (fetchSinceRaw !== startDay) {
    console.log(
      `[Rebuild] TRACKING_START_UTC is not UTC midnight; using day start ${new Date(startDay * 1000).toISOString()} (full calendar days from VRM).`,
    );
  }

  // Only full UTC days: if refEnd is mid-day, stop daily series at previous day's 23:59:59
  // so each row's odometer delta matches a complete day (sum(history) === last−first).
  const refDayFloor = floorDayUtc(refEnd);
  const refDayLastSec = refDayFloor + DAY_SEC - 1;
  const dailySeriesEndSec =
    refEnd < refDayLastSec ? refDayFloor - 1 : refEnd;

  if (dailySeriesEndSec < startDay) {
    throw new Error("No full UTC day fits in range for daily rebuild");
  }

  if (dailySeriesEndSec !== refEnd) {
    console.log(
      `[Rebuild] refEnd ${new Date(refEnd * 1000).toISOString()} is mid UTC-day; daily rows end ${new Date(dailySeriesEndSec * 1000).toISOString()} (today completed by 15m scheduler).`,
    );
  }

  const url = buildVictronUrlForInterval(
    siteId,
    startDay,
    dailySeriesEndSec,
    "days",
  );
  const headers = buildVictronAuthHeaders(opts?.token);

  const resp = await vrmGet(url, headers);
  const data = (resp.data as any) ?? {};
  const series = (data.records ?? {})[VICTRON_ATTR] ?? [];
  if (!Array.isArray(series) || series.length < 2) {
    throw new Error("VRM returned fewer than 2 daily points; cannot build days");
  }

  const totalsRaw = (data.totals ?? {})[VICTRON_ATTR];
  const totalsFieldKwh =
    typeof totalsRaw === "number" ? Number(totalsRaw) : null;

  const seriesSorted = [...series]
    .filter((row: any) => Array.isArray(row) && row.length >= 2)
    .sort((a: any, b: any) => Number(a[0]) - Number(b[0]));
  const wholeSeriesDeltaKwh = parseSolarSeriesDelta(seriesSorted as unknown[]).total;

  const points: { t: number; v: number }[] = series
    .map((row: any) => {
      if (!Array.isArray(row) || row.length < 2) return null;
      const t = Math.floor(Number(row[0]) / 1000);
      const v = Number(row[row.length - 1]);
      if (!Number.isFinite(t) || !Number.isFinite(v)) return null;
      return { t, v };
    })
    .filter(Boolean) as { t: number; v: number }[];

  points.sort((a, b) => a.t - b.t);

  const lastDayStart = floorDayUtc(dailySeriesEndSec);
  const odometerUpperT = lastDayStart + DAY_SEC;
  const pts = points.filter(
    (p) => p.t >= startDay && p.t <= odometerUpperT,
  );
  if (pts.length < 2) {
    throw new Error("After filtering to TRACKING_START day, fewer than 2 VRM points remain");
  }

  const retrievedAt = new Date().toISOString();
  let history: any[] = [];

  for (let i = 0; i < pts.length - 1; i++) {
    const t0 = pts[i].t;
    const t1 = pts[i + 1].t;
    const v0 = pts[i].v;
    const v1 = pts[i + 1].v;
    const delta = v1 >= v0 ? v1 - v0 : 0;
    if (v1 < v0) {
      console.warn(
        `[Rebuild] Odometer dip at ${new Date(t1 * 1000).toISOString()}; will fall back if totals disagree.`,
      );
    }
    const start = t0;
    let end = t1 - 1;
    end = Math.min(end, dailySeriesEndSec);
    if (start > dailySeriesEndSec || start > end) continue;

    history.push({
      start,
      end,
      value: delta,
      retrievedAt,
      vrmInterval: "days",
      vrmTotal: delta,
    });
  }

  let totalKwh = history.reduce((a, h) => a + Number(h.value || 0), 0);
  const v0 = pts[0].v;
  const vL = pts[pts.length - 1].v;
  let odometerDelta = vL >= v0 ? vL - v0 : 0;
  let sumMatches = Math.abs(totalKwh - odometerDelta) < 0.05;

  if (!sumMatches) {
    const tallyKwh =
      totalsFieldKwh != null ? totalsFieldKwh : wholeSeriesDeltaKwh;
    const src = totalsFieldKwh != null ? "totals" : "series_sorted_delta";

    console.warn(
      `[Rebuild] Per-day sum ${totalKwh} ≠ endpoint Δ ${odometerDelta}; storing one slice = ${tallyKwh} kWh (source: ${src}, series Δ ${wholeSeriesDeltaKwh}).`,
    );

    history = [
      {
        start: startDay,
        end: dailySeriesEndSec,
        value: tallyKwh,
        retrievedAt,
        vrmInterval: "days",
        vrmTotal: tallyKwh,
        vrmTallySource: src,
      },
    ];
    totalKwh = tallyKwh;
    odometerDelta = wholeSeriesDeltaKwh;
    sumMatches =
      Math.abs(totalKwh - wholeSeriesDeltaKwh) < 0.15 ||
      (totalsFieldKwh != null && Math.abs(totalKwh - totalsFieldKwh) < 0.01);
  } else {
    odometerDelta = wholeSeriesDeltaKwh;
    console.log(
      `[Rebuild] Tallies: sum(history)=${totalKwh} kWh = series Δ ${wholeSeriesDeltaKwh} kWh`,
    );
  }

  await updateSiteState(siteId, () => ({
    cumulative: totalKwh,
    lastHour: history.length ? history[history.length - 1] : null,
    history,
  }));

  return {
    entries: history.length,
    totalKwh,
    rangeStartEpochSec: startDay,
    rangeEndEpochSec: dailySeriesEndSec,
    vrm_odometer_delta_kwh: odometerDelta,
    sum_matches_odometer_delta: sumMatches,
  };
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
