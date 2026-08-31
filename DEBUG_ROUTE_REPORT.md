# Debug Route Report

## Summary

The production 404 for /api/debug/chart-provider is not caused by a missing route in the current codebase. The route is present and registered on the Express app in the backend server entrypoint.

## 1) Route file

- Route definition is in: ledgerview-backend/server.js

## 2) Router filename

- Router filename: N/A
- This route is not defined in a separate router module.
- It is registered directly on the Express app instance in server.js.

## 3) Mounted path

- Mounted path: /api/debug/chart-provider

## 4) Express registration code

```js
app.get('/api/debug/chart-provider', (req, res) => {
  const expectedKeys = ['ANGEL_API_KEY', 'ANGEL_CLIENT_CODE', 'ANGEL_MPIN', 'ANGEL_TOTP_SECRET'];
  const aliasKeys = ['ANGELONE_API_KEY', 'ANGELONE_CLIENT_CODE', 'ANGELONE_MPIN', 'ANGELONE_TOTP_SECRET'];
  const environmentStatus = expectedKeys.reduce((acc, key, index) => {
    const alias = aliasKeys[index];
    acc[key] = {
      present: Boolean(process.env[key]),
      aliasPresent: Boolean(process.env[alias]),
      aliasKey: alias,
    };
    return acc;
  }, {});

  res.json({
    activeProvider: process.env.ANGEL_CLIENT_CODE || process.env.ANGELONE_CLIENT_CODE ? 'Angel One' : 'Unavailable',
    fallbackProvider: 'Yahoo Finance',
    environmentStatus,
    chartProviderInitialized: true,
  });
});
```

## 5) Expected URL

- GET /api/debug/chart-provider

## 6) Actual URL

- Actual registered URL in the app: /api/debug/chart-provider

## 7) Route verification

Verified by reading the server file and by inspecting the Express route stack:

```json
[
  {
    "path": "/api/health",
    "methods": ["get"]
  },
  {
    "path": "/api/debug/chart-provider",
    "methods": ["get"]
  }
]
```

## 8) Export correctness

- The route is not exported as a standalone router module.
- It is attached directly to app and the app is exported correctly from server.js:

```js
module.exports = { app, startServer };
```

## 9) Express app inclusion

The route is included in the app instance and is live in the current backend:

```js
const app = express();
app.get('/api/debug/chart-provider', ...);
```

## 10) Debug routes currently available

Current debug routes in the app:

- GET /api/debug/chart-provider

## 11) Production note

If production still responds with "Cannot GET /api/debug/chart-provider", the most likely cause is that the deployed service does not yet contain the latest backend code or has not been restarted/redeployed after the change.

The current repo code includes the route and it is mounted on the Express app.
