# LedgerView Deployment Report

## Executive Summary

LedgerView is currently in a pre-production state. The backend is structurally sound and the core API routes pass automated smoke tests when run against an in-memory MongoDB instance. The frontend is a static HTML application and does not require a bundler or Node build step; it is served directly as static content. The main blockers to production deployment are:

- no MongoDB Atlas URI configured in the live environment
- no production-safe environment variable file committed to the repo
- no real Angel One credentials configured in the deployment environment
- no hardened deployment runtime for the frontend beyond static hosting
- the app is a prototype and still relies on demo/mock patterns for some flows

## Frontend Readiness

### Build verification

- Frontend build system: none configured. The app is a single-file HTML UI and is intended to be served as static files.
- Verification method: served via `python3 -m http.server 8000` and confirmed the HTML loads successfully.
- Result: static frontend is loadable, but there is no compiled build artifact or framework pipeline.

### Build errors

- No package-based frontend build errors were present because no frontend build tooling is configured.
- The app does not include a package.json at the repo root or a bundler setup for Vite/React/Next.js/webpack.
- The only runtime concerns are script-level assumptions inside the static HTML file rather than compile-time errors.

### Missing packages

- Root frontend has no package.json; no Node dependency installation is required for the static page.
- Backend dependencies are correctly declared in `ledgerview-backend/package.json` and were installed successfully.

### Responsiveness

- Mobile: the stylesheet defines compact mobile behavior under `@media` rules and bottom navigation is present.
- Tablet: the layout adapts via grid column adjustments at `max-width: 980px` and `max-width: 640px` breakpoints.
- Desktop: wide layout uses the sidebar and main content layout without issue.

### Theme validation

- Dark theme is the default design, with a light variant toggled by `data-theme="light"`.
- Theme switch function is present in `Frontend.html` and updates the document root attribute correctly.

### Route validation

The frontend route registry in `Frontend.html` contains the following routes:

- home
- livemarkets
- markets
- stocks
- stockdetail
- fo
- optionchain
- fiidii
- research
- reportdetail
- trades
- news
- watchlist
- profile
- settings
- search
- alerts
- intelligence
- global
- commodities
- ipo
- screener

These are wired into `ROUTES` and the shell navigation renders consistent anchor buttons, so the route map is internally complete.

### Broken link / broken button audit

- No hard-coded missing route target was found in the `ROUTES` map.
- Some navigation buttons lead to routes that are prototype-only and not backed by a live backend yet, but they are not broken from a routing standpoint.
- The bigger concern is that several actions remain UI-only and do not connect to secure backend logic yet.

## Backend Validation

### Express startup result

- Verified with `node server.js` in a configured environment.
- On a machine without MongoDB running locally, startup fails with `ECONNREFUSED 127.0.0.1:27017`, which is expected when Atlas or a local MongoDB service is unavailable.
- In test mode with an in-memory MongoDB instance, the app starts successfully and the API tests pass.

### MongoDB Atlas connection

- The app expects `MONGODB_URI` from Atlas or a local MongoDB instance.
- The configuration is valid, but Atlas connectivity cannot be proven without a real Atlas connection string and network access.

### Models

- `User.js` validates the expected phone/name/OTP fields.
- `Watchlist.js` validates nested item structure and a unique composite key on `(userId, name)`.
- Both model definitions are valid for the current feature set.

### JWT auth

- JWT auth is implemented in `middleware/auth.js` and works with bearer tokens.
- Refresh token support was added to `routes/auth.js` for safer token rotation.

### Phone OTP flow

- OTP generation and storage works, and the endpoint validates phone formatting.
- In production, SMS delivery must be wired to an external provider such as Twilio or MSG91.

### Watchlists

- Protected endpoints are implemented and validated.
- Create/list/delete/add-item/remove-item flows are present.

### Angel One integration

- Integration uses a server-side `angelOneService.js` with environment-driven credentials.
- This is the correct pattern for keeping broker credentials off the frontend.
- Actual live calls still require valid Angel One credentials and network access.

### Health endpoint

- `GET /api/health` returns `{ ok: true, service: 'ledgerview-backend' }`.

### Market indices endpoint

- `GET /api/market/indices` returns results for configured index tokens when the environment is valid.
- It will fail gracefully with `502` if the backend cannot reach Angel One or the instrument tokens are invalid.

## Environment Review

Required environment variables are defined in the code and should be set in production:

- `PORT`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `ANGEL_CLIENT_CODE`
- `ANGEL_MPIN`
- `ANGEL_TOTP_SECRET`
- `ANGEL_API_KEY`
- `CORS_ORIGIN`

The app also supports compatibility aliases for the existing naming in the repo (`ANGELONE_*`), which is helpful during migration.

## Deployment Status

- Deployment readiness: 58%
- Production readiness: 42%

## Critical Issues

1. No production MongoDB connection configured.
2. No real Angel One credentials in the live environment.
3. No strict production `.env` management in this repo.
4. Frontend is static prototype HTML; no CDN or static hosting pipeline is defined yet.
5. Authentication still needs a real SMS provider for production OTP delivery.
6. CORS and secrets management are not yet hardened for public deployment.
7. No CI/CD deploy workflow exists yet.

## Recommended Next Steps

1. Add a real Atlas URI and verify connectivity from the deployment host.
2. Set the required environment variables via a secrets manager.
3. Configure a real SMS provider to deliver OTPs.
4. Add a hardened deployment pipeline with Docker and GitHub Actions.
5. Move to CDN static hosting for the frontend and a dedicated Node host for the API.
6. Add rate limiting, request validation, and an audit log layer before public release.
7. Add end-to-end tests against the real Express app and a staging MongoDB instance.
