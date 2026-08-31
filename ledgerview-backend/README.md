# LedgerView Backend

A real Node.js/Express backend for LedgerView: MongoDB Atlas for user
profiles & watchlists, and a genuine Angel One SmartAPI integration for
live NSE quotes. LedgerView is an Indian-markets **research platform, not
a broker** — this backend never places trades; it only reads market data
and lets a user optionally link their broker for reference.

## Security — read this first

- Your Angel One API key, client code, MPIN, and TOTP secret live **only**
  in your own `.env` file on your own machine/server. They are never sent
  to the frontend, never logged, and never should be pasted into a chat,
  a GitHub issue, or committed to git.
- Add `.env` to your `.gitignore` before your first commit.
- `otplib` generates fresh 6-digit TOTP codes from your stored TOTP
  *secret* automatically — you don't type a code by hand each time, but
  the secret itself is exactly as sensitive as a password.
- This project's own user login (phone + OTP, for LedgerView accounts)
  is separate from Angel One entirely. Its OTP is currently just logged
  to the server console — wire in a real SMS provider (Twilio, MSG91,
  etc.) in `routes/auth.js` before using this with real phone numbers.

## Setup

```bash
cd ledgerview-backend
npm install
cp .env.example .env
# now edit .env and fill in:
#   MONGODB_URI            (MongoDB Atlas -> Connect -> Drivers)
#   JWT_SECRET              (any random 32+ char string)
#   ANGELONE_API_KEY        (smartapi.angelone.in -> your app)
#   ANGELONE_CLIENT_CODE    (your Angel One client ID)
#   ANGELONE_MPIN           (your Angel One trading PIN)
#   ANGELONE_TOTP_SECRET    (the base32 secret behind the QR code at
#                            smartapi.angelone.in/enable-totp — not the
#                            6-digit code itself, the underlying secret)
npm start
```

You should see:

```
[db] Connected to MongoDB Atlas
[server] LedgerView backend listening on :4000
```

Test it:

```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/market/indices
```

The second call performs a real Angel One login + live LTP fetch for
NIFTY 50 and BANK NIFTY. If your credentials are correct you'll get back
real current index levels.

## API surface

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/health` | GET | — | Liveness check |
| `/api/auth/send-otp` | POST | — | `{phone}` → generates + stores an OTP |
| `/api/auth/verify-otp` | POST | — | `{phone, otp, name?}` → returns a JWT |
| `/api/watchlists` | GET | Bearer JWT | All of the user's watchlists |
| `/api/watchlists` | POST | Bearer JWT | `{name}` → create a watchlist |
| `/api/watchlists/:name` | DELETE | Bearer JWT | Delete a watchlist |
| `/api/watchlists/:name/items` | POST | Bearer JWT | Add a symbol |
| `/api/watchlists/:name/items/:sym` | DELETE | Bearer JWT | Remove a symbol |
| `/api/market/indices` | GET | — | Live NIFTY 50 / BANK NIFTY via Angel One |
| `/api/market/stock/:sym` | GET | — | Live LTP for one NSE equity |
| `/api/market/stocks` | POST | — | `{symbols:[...]}` → batch live LTPs |

## Connecting the LedgerView frontend

In the LedgerView HTML file, open **Settings** and enter this server's
URL (e.g. `http://localhost:4000` while developing, or your deployed
URL). Once set, the frontend calls these real endpoints instead of its
built-in simulation/AI-fetch fallback for indices and watchlists.

## Deploying

Any Node host works (Render, Railway, Fly.io, a VPS, etc.). Whichever you
pick:
1. Set the same environment variables from `.env` in that host's secret
   manager — never in a Dockerfile, never in a public repo.
2. Set `CORS_ORIGIN` to your actual deployed frontend URL(s).
3. MongoDB Atlas → Network Access → allow your host's outbound IP (or
   `0.0.0.0/0` if your host uses dynamic IPs, understanding that widens
   who can attempt to reach your cluster — pair it with a strong DB user
   password either way).

## Known limitations

- `getIndexQuote` only covers NIFTY 50 and BANK NIFTY out of the box
  (their instrument tokens are stable/well-known). SENSEX is a BSE
  instrument — verify its token in your own Angel One account before
  relying on it.
- Individual stock quotes require Angel One's instrument master file
  (`loadInstrumentMaster()`), which is ~5-10MB and fetched once then
  cached in memory — the first stock quote after a server restart will
  be slower than the rest.
- Angel One sessions are valid until midnight IST; this backend
  re-logs-in automatically after 6 hours or on a 401, rather than
  tracking exact midnight expiry.
- This backend does not place orders. Extending it to trade would mean
  wiring up `/rest/secure/angelbroking/order/v1/placeOrder` — a much
  higher-stakes addition that deserves its own careful review (real
  money moving on real mistakes) before being built.
