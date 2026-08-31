# Chart 429 Fix Report

## Cache Strategy

Historical candles are cached in the backend process by normalized symbol and timeframe, using keys such as:

- `NIFTY_1D`
- `NIFTY_1W`
- `RELIANCE_1D`
- `HDFCBANK_1M`

Cache durations:

- `1D`: 1 minute
- `1W`: 5 minutes
- `1M`: 15 minutes
- `3M`: 30 minutes
- `1Y`: 1 hour

Fresh cache entries return immediately and log `Cache Hit`. Cache misses log `Cache Miss` and are stored after a successful primary or fallback response.

## 429 Mitigation

- Historical provider requests are serialized through an in-memory queue.
- A minimum one-second interval is enforced between provider requests, configurable with `CHART_PROVIDER_MIN_INTERVAL_MS`.
- Concurrent requests for the same symbol/timeframe share one in-flight promise, preventing duplicate Angel One requests.
- Expired cache entries remain available as stale candles if all providers fail.
- Angel One HTTP 429 responses are explicitly logged as `Angel One 429`.

## Fallback Logic

When Angel One candle retrieval fails, including HTTP 429, the service requests real OHLC candles from Yahoo Finance for:

- NIFTY (`^NSEI`)
- BANKNIFTY (`^NSEBANK`)
- RELIANCE (`RELIANCE.NS`)
- HDFCBANK (`HDFCBANK.NS`)
- ICICIBANK (`ICICIBANK.NS`)
- TCS (`TCS.NS`)

Fallback activation is logged as `Fallback Activated`. The API preserves the existing `points` candle contract. If a stale entry exists, it is returned before failing the request. If no candle source is available, the route returns HTTP 200 with a structured `CHART_DATA_UNAVAILABLE` error and an empty `points` array instead of HTTP 502.

## Expected Request Volume

With four symbols and all five supported timeframes requested continuously, the cache allows at most approximately 316 provider refreshes per hour under normal cache expiry:

`4 × (60 + 12 + 4 + 2 + 1) = 316 requests/hour`

The one-second queue throttle caps actual provider dispatch at approximately 60 requests/hour per backend process when the queue is continuously populated. Normal traffic should be substantially lower because cache hits and in-flight request coalescing avoid provider calls.

## Deployment Steps

1. Deploy the updated `ledgerview-backend/services/angelOneService.js` and `ledgerview-backend/routes/market.js` to the backend service.
2. Set `CHART_PROVIDER_MIN_INTERVAL_MS` only if a longer provider interval is required; the default is 1000 ms.
3. Restart the backend so the new queue and in-memory cache are initialized.
4. Validate `GET /api/market/chart/NIFTY`, `BANKNIFTY`, `RELIANCE`, and `HDFCBANK` with their supported ranges.
5. Confirm logs include `Cache Miss`, `Cache Hit`, `Angel One 429`, and `Fallback Activated` during provider throttling tests.
6. Confirm the response contains a non-empty `points` array or the structured `CHART_DATA_UNAVAILABLE` error object.

The frontend and UI were not modified.

## Validation

- Local concurrent requests returned HTTP 200 with real candle points and joined a single queued request.
- A repeated request returned `cached=true` and candle points.
- Existing backend suite passes: 7 tests, 0 failures.
- JavaScript and whitespace checks pass.
