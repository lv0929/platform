# Launch Blockers Report

## Working Navigation Links

Homepage navbar now includes working links for:

- Home
- Markets
- Features
- Research
- Pricing
- About
- Help
- SEBI
- Login
- Get Started

The following static pages exist and are linked correctly:

- `about.html`
- `help.html`
- `contact.html`
- `sebi.html`
- `login.html`

Footers now include working links for About, Contact, Help, Privacy Policy, Terms of Use, SEBI Guidelines, Investor Charter, Risk Disclosure, and Grievance Redressal. Disclosure links resolve to anchored sections in `sebi.html`.

## Broken Links

No broken local HTML file targets remain in the updated navigation and footer markup.

The homepage `Markets`, `Features`, `Research`, and `Pricing` links intentionally resolve to the existing homepage because those fragment IDs are not present in the terminal page.

## Chart Fix Status

Fixed `GET /api/market/chart/:symbol` so supported symbols fall back to real Yahoo Finance OHLC candles when Angel One historical candles fail:

- `NIFTY`
- `BANKNIFTY`
- `RELIANCE`
- `HDFCBANK`

Local validation returned HTTP 200 with 22 candle points for each symbol using `range=1M`.

The homepage chart section already loads automatically through `loadTerminal()` and `renderCharts()`. The chart controls now render dynamically into a real `chartSymbolButtons` container instead of exposing raw template code.

## Remaining Launch Blockers

The deployed Render backend currently returns HTTP 502 for the four chart endpoints because it is still running the pre-fix revision. The updated source must be committed and deployed to Render before production chart validation can pass.

Vercel is a static frontend in this repository and has no frontend build step or build configuration requirement. After the backend redeploy, verify the Vercel homepage in a browser and confirm the terminal API, chart SVG, search dropdown, and navbar links in the browser console and Network panel.

## Validation Evidence

- Inline `index.html` JavaScript passes `node --check`.
- `git diff --check` passes.
- Local static HTML target validation passes.
- Local chart routes return HTTP 200 and real candle arrays for all four required symbols.
- Existing backend test suite passes: 7 tests, 0 failures.
- Current deployed chart check: all four old Render endpoints return HTTP 502 pending redeployment.
