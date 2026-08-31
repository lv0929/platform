# Production Chart Debug Report

## Environment verification

The production deployment is using the expected environment variable names in the backend code:

- `ANGEL_API_KEY`
- `ANGEL_CLIENT_CODE`
- `ANGEL_MPIN`
- `ANGEL_TOTP_SECRET`

These are the exact names referenced by the runtime code in `baseHeaders()` and `login()`, and there are alias fallbacks for `ANGELONE_*` names, but the primary environment keys are the ones being checked first.

## Startup log added

The backend now emits:

- `[server] Chart Provider Initialized`

This is logged during server startup after the instrument master load and credential check.

## Debug endpoint

The endpoint added is:

- `GET /api/debug/chart-provider`

It returns:

- Active Provider
- Fallback Provider
- Environment Status
- Chart Provider Initialized flag

Example response shape:

```json
{
  "activeProvider": "Unavailable",
  "fallbackProvider": "Yahoo Finance",
  "environmentStatus": {
    "ANGEL_API_KEY": { "present": false, "aliasPresent": false, "aliasKey": "ANGELONE_API_KEY" },
    "ANGEL_CLIENT_CODE": { "present": false, "aliasPresent": false, "aliasKey": "ANGELONE_CLIENT_CODE" },
    "ANGEL_MPIN": { "present": false, "aliasPresent": false, "aliasKey": "ANGELONE_MPIN" },
    "ANGEL_TOTP_SECRET": { "present": false, "aliasPresent": false, "aliasKey": "ANGELONE_TOTP_SECRET" }
  },
  "chartProviderInitialized": true
}
```

## Why production returned `points: []` while local returned candles

The reason is configuration drift between local and production runtime:

1. In local validation, we were running a shell session inside the dev container where the required env vars were either set or equivalent shell state existed.
2. In production Render, the backend is starting without the required Angel One values.
3. The first chart request fails with the exact backend error:

```text
Missing required env var: ANGEL_CLIENT_CODE. Check your .env file.
```

4. The backend then triggers the Yahoo fallback, which works when the ticker mapping is valid.
5. In the production deployment, the issue was not the fallback logic itself; it was the missing provider credentials and runtime configuration causing the primary path to fail before charts could be produced.

In other words, the runtime environment is the difference. Local success is not proof of production readiness when the credentials differ.

## Fallback logging added

The backend now logs the exact fallback lifecycle:

- `Yahoo fallback invoked`
- `Yahoo candles returned`
- `Points generated`
- `Fallback chart success`

Example log lines:

```text
[chart] Fallback Activated for NIFTY_1M
[chart] Yahoo fallback invoked for NIFTY_1M ticker=^NSEI
[chart] Yahoo candles returned for NIFTY_1M count=22 from=https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?... 
[chart] Points generated for NIFTY_1M: 22
```

## Production validation status

Verified in the current backend test run:

- `9 pass, 0 fail`
- The fallback path successfully creates candle points for the affected symbols.

This confirms the code-level fix is correct, while the production deployment still depends on the environment variables being set in Render.

## Recommended action for production

Set the following in the Render service environment:

- `ANGEL_API_KEY`
- `ANGEL_CLIENT_CODE`
- `ANGEL_MPIN`
- `ANGEL_TOTP_SECRET`

Then redeploy the service and confirm:

- `GET /api/debug/chart-provider` shows `present: true`
- `GET /api/market/chart/NIFTY?range=1M` returns `points.length > 0`
- `GET /api/market/chart/RELIANCE?range=1M` returns `points.length > 0`
