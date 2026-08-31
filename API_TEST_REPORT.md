# API Test Report

## Summary

API smoke tests were executed against the backend with an in-memory MongoDB instance. All requested validation checks passed for the current prototype contract.

## Included tests

- `tests/api-health.test.js`
- `tests/auth.test.js`
- `tests/watchlist.test.js`
- `tests/market.test.js`

## Evidence

Command run:

```bash
cd /workspaces/platform/ledgerview-backend && npm test -- --test-reporter=spec
```

Observed pass result:

- 4 tests passed
- 0 tests failed

## Test coverage

### `api-health.test.js`

- Verifies `GET /api/health` returns `200` and the expected service payload.

### `auth.test.js`

- Verifies `POST /api/auth/send-otp` accepts a valid phone number and returns a success payload.

### `watchlist.test.js`

- Verifies unauthenticated access to the watchlist route is rejected with `401`.

### `market.test.js`

- Verifies `GET /api/market/indices` responds with an index object shape.

## Production caveat

These tests validate the app contract and route behavior, but they do not validate live Angel One or Atlas access without real environment credentials.
