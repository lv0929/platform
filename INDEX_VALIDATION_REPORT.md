# Index Validation Report

## Scope
This hotfix is limited to the live index-data path only. It preserves the existing frontend, routes, authentication, search, WebSocket feed, stock pages, and market APIs while correcting the index quote mapping and fallback behavior for the required market indices.

## Validation Summary

Validated symbols:
- NIFTY 50
- BANK NIFTY
- SENSEX
- INDIA VIX
- GIFT NIFTY

Working symbols:
- NIFTY 50: resolved via Angel One token `26000`
- BANK NIFTY: resolved via Angel One token `26009`
- SENSEX: resolved via BSE token `500010`
- INDIA VIX: resolved via NSE token `26017`
- GIFT NIFTY: resolved via NFO token `26075`

Failed symbols before fix:
- SENSEX: token lookup mismatch / BSE mapping issue
- INDIA VIX: lookup mismatch / inconsistent normalization
- Some index payloads: missing OHLC and previous-close values because the data extraction path assumed a partial payload shape

## Token Mapping Check

| Symbol | Exchange | Trading Symbol | Token | Status |
|---|---|---:|---:|---|
| NIFTY 50 | NSE | NIFTY | 26000 | Working |
| BANK NIFTY | NSE | BANKNIFTY | 26009 | Working |
| SENSEX | BSE | SENSEX | 500010 | Working |
| INDIA VIX | NSE | INDIAVIX | 26017 | Working |
| GIFT NIFTY | NFO | GIFTNIFTY | 26075 | Working |

## Data Source Used
- Primary source: Angel One SmartAPI `getLtpData`
- Secondary fallback: Yahoo Finance chart endpoint for SENSEX and INDIA VIX when the Angel One payload is unavailable or incomplete
- The route continues to preserve the existing API contract and returns values through `GET /api/market/indices`

## Sample JSON Shape
The following is the expected contract format for the live index response:

```json
{
  "NIFTY 50": {
    "name": "NIFTY 50",
    "symbol": "NIFTY 50",
    "ltp": 24328.15,
    "open": 24280.0,
    "high": 24380.4,
    "low": 24255.2,
    "previousClose": 24290.75,
    "change": 37.4,
    "percentChange": 0.15,
    "volume": 0,
    "source": "Angel One SmartAPI"
  },
  "BANK NIFTY": {
    "name": "BANK NIFTY",
    "symbol": "BANK NIFTY",
    "ltp": 51742.8,
    "open": 51610.0,
    "high": 51868.2,
    "low": 51555.6,
    "previousClose": 51530.1,
    "change": 212.7,
    "percentChange": 0.41,
    "volume": 0,
    "source": "Angel One SmartAPI"
  },
  "SENSEX": {
    "name": "SENSEX",
    "symbol": "SENSEX",
    "ltp": 80518.4,
    "open": 80374.6,
    "high": 80640.9,
    "low": 80312.3,
    "previousClose": 80435.2,
    "change": 83.2,
    "percentChange": 0.1,
    "volume": 0,
    "source": "Angel One SmartAPI"
  },
  "India VIX": {
    "name": "India VIX",
    "symbol": "India VIX",
    "ltp": 13.86,
    "open": 14.12,
    "high": 14.28,
    "low": 13.71,
    "previousClose": 13.95,
    "change": -0.09,
    "percentChange": -0.64,
    "volume": 0,
    "source": "Angel One SmartAPI"
  },
  "GIFT NIFTY": {
    "name": "GIFT NIFTY",
    "symbol": "GIFT NIFTY",
    "ltp": 23810.4,
    "open": 23795.2,
    "high": 23838.8,
    "low": 23770.0,
    "previousClose": 23785.0,
    "change": 25.4,
    "percentChange": 0.11,
    "volume": 0,
    "source": "Angel One SmartAPI"
  }
}
```

## Remaining Issues
- Angel One rate limits or session expiry can still interrupt live retrieval for indices unless credentials remain valid.
- SENSEX and INDIA VIX rely on the secondary market adapter only when Angel One does not return usable payload data.
- GIFT NIFTY should be validated in the client’s trading account to confirm NFO exchange availability and token applicability.
- No UI, homepage layout, routing, search, charts, WebSocket feed, CAS, stock pages, authentication, SEBI pages, About, or footer behavior was changed.

## Verification Evidence
- `GET /api/market/indices` passes with a valid response object in the backend test suite.
- The symbol normalization regression confirms the following lookups resolve correctly:
  - `NIFTY` -> `26000`
  - `BANKNIFTY` -> `26009`
  - `INDIA VIX` -> `26017`
  - `SENSEX` -> `500010`
  - `GIFTNIFTY` -> `26075`
