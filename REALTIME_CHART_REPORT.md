# Real-Time Chart Report

## Completed

- Kept `GET /api/market/chart/:symbol` for historical Angel One candle data.
- Kept `GET /api/market/quote/:symbol` for normalized live quote data.
- Added backend WebSocket feed service at `/ws/market`.
- Supports symbol subscriptions through the URL query string or a JSON `subscribe` message.
- Streams LTP, volume, bid, ask, timestamp, change, percentage change, OHLC, and previous close.
- Added frontend WebSocket subscription for chart symbols.
- Live ticks update the active candle and redraw the chart immediately.
- Live chart updates include current price, previous close, today’s change, OHLC, last trade time, previous-close line, and volume bars.
- Charts attempt to draw immediately from in-memory or localStorage candle cache after page load.
- Historical candle responses and successful chart series are cached in localStorage.
- Cached candles are rendered when the backend chart request fails.
- Added responsive live chart metadata layout.

## WebSocket protocol

Connect to:

`wss://<backend-host>/ws/market?symbols=RELIANCE,HDFCBANK`

Or subscribe after connecting:

```json
{
  "type": "subscribe",
  "symbols": ["RELIANCE", "HDFCBANK"]
}
```

Quote messages use:

```json
{
  "type": "quote",
  "symbol": "RELIANCE",
  "ltp": 0,
  "volume": 0,
  "bid": 0,
  "ask": 0,
  "timestamp": "2026-08-31T00:00:00.000Z"
}
```

Numeric values are supplied by the Angel One quote service at runtime. The feed currently polls the authenticated Angel One quote client every 5 seconds per connected subscription and broadcasts the resulting tick over WebSocket.

## Validation

- Frontend inline JavaScript syntax check passed.
- Backend syntax checks passed.
- Focused WebSocket integration check passed with LTP, volume, bid, ask, and timestamp assertions.
- Existing backend test suite passed: 4 tests passed, 0 failed.
- Editor diagnostics reported no errors in updated files.

## Deployment note

The Render service must be redeployed from the current repository state for `/ws/market`, the live quote contract, and historical candle updates to be available on the public deployment. Render must support WebSocket upgrades for the configured service.
