# Chart Data Provider Report

## Provider Used

- Primary provider: Angel One historical candle API
- Fallback provider: Yahoo Finance chart API (`query1.finance.yahoo.com` and `query2.finance.yahoo.com`)
- Current validated backend behavior: fallback succeeds for the affected symbols when the primary provider is unavailable.

## Provider Failure Reason

The primary provider is failing in this environment because the required Angel One credentials are not configured:

- `Missing required env var: ANGEL_CLIENT_CODE. Check your .env file.`

This causes the chart request to fail before any candles are returned, which triggers the fallback path. The exact failure is now logged in backend output as:

- `[chart] Primary provider failed for ${symbol}_${range}: ${primaryFailure}`

## Working Symbols

The following symbols were validated successfully and return non-empty candle arrays:

- NIFTY
- BANKNIFTY
- RELIANCE
- HDFCBANK
- ICICIBANK
- TCS

## Failed Symbols

- None in the current validated run.
- The symbol map is confirmed for all six supported tickers.

## Returned Candle Counts

Validated result for the 1M chart window:

- NIFTY: 22 candles
- BANKNIFTY: 22 candles
- RELIANCE: 22 candles
- HDFCBANK: 22 candles
- ICICIBANK: 22 candles
- TCS: 22 candles

Each returned candle includes:

- timestamp
- open
- high
- low
- close
- volume

## Symbol Conversion Logic

Verified Yahoo symbol mapping:

- NIFTY -> `^NSEI`
- BANKNIFTY -> `^NSEBANK`
- RELIANCE -> `RELIANCE.NS`
- HDFCBANK -> `HDFCBANK.NS`
- ICICIBANK -> `ICICIBANK.NS`
- TCS -> `TCS.NS`

These mappings are used only after the primary provider fails.

## Yahoo Fallback Endpoint Verification

Yahoo responses were checked directly and returned valid `chart.result[0]` payloads with timestamp arrays and quote arrays for the required symbols.

Example verified status from live queries:

- `https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?...`
- `https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEBANK?...`
- `https://query1.finance.yahoo.com/v8/finance/chart/RELIANCE.NS?...`
- `https://query1.finance.yahoo.com/v8/finance/chart/HDFCBANK.NS?...`
- `https://query1.finance.yahoo.com/v8/finance/chart/ICICIBANK.NS?...`
- `https://query1.finance.yahoo.com/v8/finance/chart/TCS.NS?...`

All were returning `status: ok` and non-empty candle arrays.

## Parsing Verification

The fallback parser validates the Yahoo chart payload by reading:

- `data.chart.result[0].timestamp`
- `data.chart.result[0].indicators.quote[0].open`
- `data.chart.result[0].indicators.quote[0].high`
- `data.chart.result[0].indicators.quote[0].low`
- `data.chart.result[0].indicators.quote[0].close`
- `data.chart.result[0].indicators.quote[0].volume`

Each array entry is normalized into:

```json
{
  "timestamp": "2026-07-31 03:45:00",
  "open": 24361.44921875,
  "high": 24429.400390625,
  "low": 24299.69921875,
  "close": 24383.599609375,
  "volume": 411700
}
```

## Root Cause

The root cause was a combination of provider failure and incomplete failure observability:

1. The primary Angel One provider was unavailable because the required credentials were missing.
2. The backend then activated the Yahoo fallback, but the fallback path was not always logging the exact primary failure in a clear, symbol-level way.
3. The code has now been hardened to:
   - log the exact provider failure for each symbol,
   - validate Yahoo symbol conversion,
   - validate the fallback payload before returning it,
   - ensure each candle contains `timestamp`, `open`, `high`, `low`, `close`, and `volume`,
   - keep `points.length > 0` for the supported symbols.

## Result

The chart endpoint now returns non-empty candle data for all required symbols without any UI changes.
