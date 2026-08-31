# Symbol Search Report

## Completed

- Added startup loading of Angel One `OpenAPIScripMaster.json`.
- Normalized every NSE and BSE instrument into an in-memory symbol universe.
- Indexed symbol, company name, exchange, token, and trading symbol metadata.
- Added `GET /api/market/search?q=term`.
- Search matches both symbol and company name, case-insensitively.
- Added `GET /api/market/stock/:symbol`.
- Stock detail returns `name`, `symbol`, `exchange`, `ltp`, `change`, `volume`, `open`, `high`, `low`, `52wHigh`, `52wLow`, and `marketCap`.
- Unavailable broker fields are returned as `null`; no fabricated market values are generated.
- Kept the existing `/api/market/quote/:symbol` endpoint for compatibility.

## Search behavior

Examples such as `reliance`, `hdfc`, `icici`, `motilal`, and `tata` are matched against both the normalized symbol and the Angel One company/name field. Results return:

```json
{
  "symbol": "RELIANCE",
  "name": "Reliance Industries",
  "exchange": "NSE",
  "token": "runtime-token"
}
```

The actual token value is supplied by the downloaded Angel One master at runtime.

## Startup behavior

`startServer()` now downloads and indexes the instrument master before starting the Angel One login flow. Concurrent requests share one in-flight download promise, and failed downloads clear that promise so a later request can retry.

## Validation

- `node --check` passes for the updated service, routes, and server.
- Existing backend test suite passes: 4 tests passed, 0 failed.
- Editor diagnostics report no errors in the updated files.

## Remaining limitations

Angel One LTP responses do not provide 52-week high, 52-week low, or market capitalization through the current quote call, so those response fields are explicitly `null` until a fundamentals/market-statistics provider is connected. Stock detail requires the Angel One credentials and instrument master to be available at runtime.
