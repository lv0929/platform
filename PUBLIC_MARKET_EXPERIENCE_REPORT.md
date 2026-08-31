# Public Market Experience Report

## Completed

LedgerView homepage authentication has been changed from a required login flow to a public market experience.

- Homepage is publicly viewable without authentication.
- Added public navbar links: Home, Markets, Features, Pricing, About, Help, Login, and Get Started.
- Login and Get Started link to `login.html`.
- Only `watchlist`, `portfolio`, and `alerts` SPA routes redirect unauthenticated visitors to `login.html`.
- The standalone `app.html` continues to enforce its own authentication check.
- Removed the first-paint login gate from the homepage.

## Homepage market experience

The homepage now includes live-data areas for:

- NIFTY 50
- BANK NIFTY
- SENSEX
- Top Gainers
- Top Losers
- Most Active Stocks
- Live charts for NIFTY 50, BANK NIFTY, RELIANCE, and HDFCBANK

Market requests use `https://ledgerview-backend-tzxp.onrender.com` by default and the existing stored backend URL when a visitor has changed it in Settings.

Each homepage refresh requests:

- `/api/market/indices`
- `/api/market/stocks`
- `/api/market/gainers`
- `/api/market/losers`
- `/api/market/most-active`
- `/api/market/chart/:symbol`

The refresh interval is 15 seconds. The homepage displays `Last Updated` and `Source: Angel One SmartAPI`. The market status indicator displays `Live` or `Closed` based on the existing NSE session calendar.

## Responsive behavior

The public navbar wraps on narrow screens, hides the secondary CTA group on mobile, and the four homepage charts collapse to a single-column layout below 700px.

## Validation

- `index.html` inline JavaScript syntax check passed.
- Editor diagnostics reported no errors for `index.html`.
- Backend regression suite passed: 4 tests passed, 0 failed.
- Render health endpoint is reachable at `https://ledgerview-backend-tzxp.onrender.com/api/health`.

The deployed Render instance still needs to be redeployed from the current repository state before its newly added market routes are available publicly.
