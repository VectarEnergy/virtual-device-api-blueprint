## Virtual Device API Blueprint — Solar Yield Proxy

This repository provides a focused Node.js + TypeScript service that exposes a single public route:

- `GET /installations/solar-yield`

The service collects hourly `solar_yield` data from Victron VRM and maintains a persistent cumulative total (kWh). It is intentionally minimal: all other endpoints were removed to keep the surface area small and predictable.

## What this app does

1. Background scheduler
	 - If `VICTRON_SITE_ID` is configured, a scheduler runs at the next UTC top-of-hour and then every hour.
	 - Each run requests the previous completed hour from the Victron `stats` API for the `solar_yield` attribute and computes the hour increment (delta).
	 - The increment is added to a persisted cumulative total and a `lastHour` record is saved to disk.

2. Single API endpoint
	 - `GET /installations/solar-yield` returns the persisted values for the configured `VICTRON_SITE_ID`:
		 - `siteId` — the site id
		 - `retrievedAt` — server time when the response was produced
		 - `lastHour` — `{ start, end, value, retrievedAt }` for the most recently collected hour
		 - `cumulative_kwh` — rounded to 2 decimal places

3. Persistence
	 - Data is stored in `data/solar-yield.json` and written atomically. The file stores per-site cumulative and history.

## Environment variables

Set these in a `.env` file or your environment:

- `PORT` — port to run the server on (default: 3000)
- `VICTRON_API_URL` — VRM base URL (e.g. `https://vrmapi.victronenergy.com/v2`)
- `VICTRON_API_TOKEN` — API token used by the scheduler (the code prefixes with `Token ` automatically)
- `VICTRON_SITE_ID` — default installation id used by the scheduler and by the `/installations/solar-yield` endpoint

**Security note:** keep `VICTRON_API_TOKEN` private and do not commit it.

## How to run

1. Install dependencies

```bash
npm install
```

2. Start in development

```bash
npm run dev
```

3. Build and run production

```bash
npm run build
npm start
```

The scheduler will start automatically if `VICTRON_SITE_ID` is set. The first scheduled run occurs at the next UTC top-of-hour.

## Example VRM request used by the scheduler

The scheduler requests the VRM `stats` endpoint using a query like:

```
GET {VICTRON_API_URL}/installations/{siteId}/stats?type=custom&interval=15mins&attributeCodes%5B%5D=solar_yield&start={start}&end={end}
Header: x-authorization: Token <YOUR_TOKEN>
```

You can call the same VRM URL directly (with your token) to inspect the raw series returned by VRM.

## API Example

Request:
```bash
curl http://localhost:3000/installations/solar-yield
```

Response (example):
```json
{
	"siteId": "312578",
	"retrievedAt": "2026-02-22T17:01:15.707Z",
	"lastHour": {
		"start": 1771776000,
		"end": 1771779599,
		"value": 0,
		"retrievedAt": "2026-02-22T17:00:05.807Z"
	},
	"cumulative_kwh": 1101418.53
}
```

## Limits and notes

- The VRM `stats` API enforces maximum allowed periods per interval (for example, 31 days for `15mins` and `hours`, 180 days for `days`, etc.). The scheduler uses a narrow hourly window and is not affected by these limits, but be aware if you expand the service.
- A `lastHour.value` of `0` may indicate no production for that hour, a missing/empty series from VRM, or a parsing mismatch.

## Next improvements (optional)

- Add an on-demand admin endpoint to re-run a fetch for a given hour (useful for debugging).
- Add retries/backoff and idempotency protections for the scheduler.
- Replace file-backed persistence with a DB (SQLite/Postgres) for multi-instance deployments.
- Add unit/integration tests and a CI job.

If you'd like me to implement any of the above improvements, tell me which and I will add them.
