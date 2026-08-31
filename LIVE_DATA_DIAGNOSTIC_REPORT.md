# Live Data Diagnostic Report

## 1) Angel One login status

Status: partially authenticated and usable for quote/search calls, but not fully healthy for historical candle requests.

Evidence:
- `GET /api/market/search?q=reliance` returned live instrument hits
- `GET /api/market/quote/RELIANCE` returned a valid quote payload
- `GET /api/market/chart/RELIANCE?range=1M` returned `400` from Angel One

This means the login/session is active enough to fetch current quotes, but the backend is failing later in the Angel One historical candle flow.

---

## 2) Endpoint-by-endpoint validation

### 2.1 GET /api/health

Status: PASS

Sample JSON:
```json
{"ok":true,"service":"ledgerview-backend"}
```

### 2.2 GET /api/market/indices

Status: PARTIAL PASS

Sample JSON:
```json
{
  "NIFTY 50": {
    "name": "NIFTY 50",
    "symbol": "NIFTY 50",
    "ltp": 24123.2,
    "previousClose": 0,
    "change": 0,
    "percentChange": 0,
    "source": "Angel One SmartAPI"
  },
  "BANK NIFTY": {
    "name": "BANK NIFTY",
    "symbol": "BANK NIFTY",
    "ltp": 57496.3,
    "previousClose": 0,
    "change": 0,
    "percentChange": 0,
    "source": "Angel One SmartAPI"
  },
  "SENSEX": {
    "name": "SENSEX",
    "error": "Symbol token not found in scrip master cache for the given exchange",
    "source": "Angel One SmartAPI"
  },
  "India VIX": {
    "name": "India VIX",
    "symbol": "India VIX",
    "ltp": 10.68,
    "previousClose": 0,
    "change": 0,
    "percentChange": 0,
    "source": "Angel One SmartAPI"
  }
}
```

Observation:
- The call succeeds, but some index values are zeroed because `previousClose` and price deltas are missing from the live payload.

### 2.3 GET /api/market/search?q=reliance

Status: PASS

Sample JSON:
```json
{
  "source": "Angel One SmartAPI",
  "items": [
    { "symbol": "RELIANCE", "name": "RELIANCE", "exchange": "NSE", "token": "2885" },
    { "symbol": "RELIANCE", "name": "RELIANCE", "exchange": "BSE", "token": "500325" }
  ]
}
```

### 2.4 GET /api/market/quote/RELIANCE

Status: PASS

Sample JSON:
```json
{
  "symbol": "RELIANCE",
  "name": "RELIANCE",
  "exchange": "NSE",
  "token": "2885",
  "ltp": 1287,
  "change": 4.8,
  "percentChange": 0.37,
  "open": 1279.5,
  "high": 1291.8,
  "low": 1280,
  "volume": 0,
  "previousClose": 1282.2,
  "raw": {
    "exchange": "NSE",
    "tradingsymbol": "RELIANCE-EQ",
    "symboltoken": "2885",
    "open": 1279.5,
    "high": 1291.8,
    "low": 1280,
    "close": 1282.2,
    "ltp": 1287
  },
  "source": "Angel One SmartAPI"
}
```

### 2.5 GET /api/market/chart/RELIANCE

Status: FAIL

Sample JSON:
```json
{"error":"Request failed with status code 400","source":"Angel One SmartAPI"}
```

### 2.6 GET /api/market/chart/HDFCBANK

Status: FAIL

Sample JSON:
```json
{"error":"Request failed with status code 400","source":"Angel One SmartAPI"}
```

### 2.7 GET /api/market/chart/BANKNIFTY

Status: FAIL

Sample JSON:
```json
{"error":"Request failed with status code 400","source":"Angel One SmartAPI"}
```

### 2.8 GET /api/market/chart/NIFTY

Status: FAIL

Sample JSON:
```json
{"error":"Request failed with status code 400","source":"Angel One SmartAPI"}
```

### 2.9 WebSocket: ws://.../ws/market

Status: PASS

WebSocket success evidence from the live probe:
```json
{"type":"ready","symbols":["RELIANCE","HDFCBANK"],"intervalMs":5000}
```

Important note:
- The actual browser-safe URL is `wss://.../ws/market` on HTTPS pages.
- The server accepts the `/ws/market` upgrade path and emits a `ready` message correctly.
- The stream is active, but it only pushes quote updates; it does not replace the missing chart data source.

### 2.10 Homepage receives data

Status: FAIL on the live deployed backend

Evidence:
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Error</title>
</head>
<body>
<pre>Cannot GET /api/market/terminal</pre>
</body>
</html>
```

This means the homepage payload route is not available in the live deployed backend, so the market cards and chart panels cannot populate from the terminal endpoint.

### 2.11 Market cards populate

Status: FAIL (indirectly) because the primary data source is missing in production.

The frontend requests:
```js
fetch(`${BACKEND_URL}/api/market/terminal`)
```

But the backend responds with `Cannot GET /api/market/terminal`.

### 2.12 Charts render candles

Status: FAIL

The chart route is returning `400 Bad Request` from Angel One for all of the following:
- `/api/market/chart/RELIANCE`
- `/api/market/chart/HDFCBANK`
- `/api/market/chart/BANKNIFTY`
- `/api/market/chart/NIFTY`

### 2.13 Search autocomplete returns results

Status: PASS

The live search endpoint is returning matches for `reliance`.

### 2.14 Frontend endpoint URLs exactly match backend routes

Status: PARTIAL MATCH

Frontend check from the page code:
```js
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:4000'
  : 'https://ledgerview-backend-tzxp.onrender.com';
```

And the fetch calls in the page are:
```js
fetch(`${BACKEND_URL}/api/market/search?q=${encodeURIComponent(term)}&limit=6`)
fetch(`${BACKEND_URL}/api/market/terminal`)
```

These exact URL paths match the intended backend route structure.

However, the deployed backend is missing `/api/market/terminal`, so the endpoint string is correct but the route is not deployed.

---

## 3) Failing endpoints

The following endpoints currently fail in live validation:

1. `/api/market/chart/RELIANCE?range=1M`
2. `/api/market/chart/HDFCBANK?range=1M`
3. `/api/market/chart/BANKNIFTY?range=1M`
4. `/api/market/chart/NIFTY?range=1M`
5. `/api/market/terminal`
6. The homepage-driven market cards are failing because they depend on the missing `/api/market/terminal` route

Additional note:
- `/api/market/indices` is not fully correct because some values are zeroed when the Angel One payload does not include a valid `previousClose` or `close` field.

---

## 4) Root cause analysis

### 4.1 Blank charts

Root cause:
- The historical candle API request is failing with HTTP 400 from Angel One.
- The backend uses the `getChartSeries` flow in `services/angelOneService.js`, which sends a candle request with the symbol token and date range.
- The request is rejected by Angel One before any candle array is returned.

Why it happens:
- `symboltoken`/`exchange`/`interval`/`fromdate` parameters are mismatched or not accepted by the historical API for the requested instrument family.
- The route is returning only the upstream API error, so the chart has no data to render.

### 4.2 Empty market cards

Root cause:
- The homepage expects the aggregated `/api/market/terminal` route, but that route is not present in the live deployment.
- The live backend returns `Cannot GET /api/market/terminal`.
- In addition, the index normalization logic can zero out `previousClose` and change values when Angel One omits those fields.

Why it happens:
- The production deployment does not include the terminal aggregator route, even though the frontend calls it.
- The page uses the terminal payload to populate cards; without the payload, every card remains blank or empty.

### 4.3 Missing search results

Root cause:
- This is not a general search failure; the search endpoint itself is working.
- The issue is likely UI-level or deployment mismatch: the frontend is not consistently pointing at the same live backend host, or the client is not rendering the returned search items in the expected component state.

Why it happens:
- `GET /api/market/search?q=reliance` returned valid data from the live backend.
- The raw API is healthy, so the missing search results are not caused by the backend search route itself.
- The frontend is the likely breakpoint only when the page is not connected to the same backend or when the autocomplete component does not bind state correctly.

---

## 5) Final conclusion

The system is only partially live:
- Quote and search requests work
- WebSocket subscription is active
- Chart requests fail downstream from Angel One
- The homepage terminal aggregation route is missing in production

This creates the exact observed symptoms:
- blank charts
- empty market cards
- missing or delayed search results in the page flow

The immediate fix is to align the deployed backend with the actual frontend routes and repair the candle request contract for Angel One historical data.
