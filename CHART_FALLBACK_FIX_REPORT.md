# Chart Fallback Fix Report

## Working Symbols

The fallback path now returns non-empty candle data for:

- NIFTY
- BANKNIFTY
- RELIANCE
- HDFCBANK
- ICICIBANK
- TCS

Local endpoint validation confirmed HTTP 200 and `points.length > 0` for all six symbols.

## Sample Candle Payload

Each returned point now includes the required fields while retaining the existing `label` and `value` fields for frontend compatibility:

```json
{
  "timestamp": "2026-08-31 10:15:00",
  "open": 24175.5,
  "high": 24380.1,
  "low": 24100.25,
  "close": 24325.75,
  "volume": 12456789,
  "label": "2026-08-31 10:15:00",
  "value": 24325.75
}
```

## Fallback Provider Used

When Angel One returns HTTP 429 or another historical-candle failure, the backend now:

1. Logs `Fallback Activated`.
2. Tries Yahoo Finance chart API on `query1.finance.yahoo.com` using the requested period and interval.
3. Tries Yahoo Finance chart API on `query2.finance.yahoo.com` using the equivalent range and interval.
4. Uses Yahoo Finance market metadata as a real single-candle fallback when the chart series is unavailable.
5. Logs `Fallback chart success` when usable candles are returned.
6. Logs `Fallback chart failed` only after all fallback forms fail.

Ticker mappings cover the six supported symbols, including `^NSEI`, `^NSEBANK`, and the four `.NS` equity tickers.

## Remaining Issues

- The fallback cache is in-memory per backend process; a multi-instance deployment will need shared storage for cross-instance cache reuse.
- Provider availability still depends on external Yahoo Finance access and rate limits.
- The updated backend must be deployed and restarted before production endpoints reflect this fix.
- No UI files were modified.

## Validation

- All six supported symbols returned HTTP 200 locally with non-empty points.
- Required candle fields were present on every sampled response.
- Existing backend tests pass: 7 tests, 0 failures.
- Frontend source was not modified.
