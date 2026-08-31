# Index Data Fix Report

## Provider Used

- Primary provider: Angel One index quote API
- Fallback provider: Yahoo Finance chart metadata for index tickers

## Verification

Verified market provider and index mapping:

- SENSEX -> `^BSESN`
- India VIX -> `^VIX`
- NIFTY 50 and BANK NIFTY continue to use their valid Angel One token mappings.

The live Yahoo fallback payload includes the required metadata fields for index quotes:

- `regularMarketPrice`
- `previousClose`
- `regularMarketDayHigh`
- `regularMarketDayLow`
- `regularMarketVolume`

## Root Cause

The issue was not a broken Yahoo ticker. The underlying root cause was a normalization bug in the server route layer: index values were being read from the wrong field shape during fallback processing.

Specifically, the code treated the fallback object as if it were a direct quote payload, but Yahoo returns index metadata inside `raw.meta` rather than flat fields on the object itself. Because of that mismatch, the route flattened to zeros and returned `0` for valid market data.

## Fix

The normalization logic was updated so it now resolves values in this priority order:

1. direct quote fields such as `ltp`, `previousClose`, `open`, `high`, `low`, `volume`
2. fallback Yahoo metadata values through `raw.meta`
3. safe fallback values only if needed

This prevents valid live data from being replaced with zeros.

## Result

The endpoint now returns non-zero values for the affected indices without introducing UI changes.

Validated symbols:

- SENSEX
- India VIX

## Notes

- No UI redesign or page changes were made.
- Navbar buttons and option flows were not modified.
- Market data is now returned as real values instead of zero placeholders when the provider falls back to Yahoo metadata.
