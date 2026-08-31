// ============================================================
// Angel One SmartAPI client.
//
// Docs: https://smartapi.angelone.in
// Base URL confirmed current as of this writing: https://apiconnect.angelone.in
// (Angel One has migrated domains before — if requests start failing with
// connection errors rather than auth errors, check smartapi.angelone.in's
// docs for a new base URL and update ROOT_URL below.)
//
// This file holds the ONLY code in the whole project that touches your
// real Angel One credentials, and it only ever runs server-side. The
// frontend never sees your API key, MPIN, or TOTP secret — it only ever
// calls this backend's own /api/market/* routes.
// ============================================================

const axios = require('axios');
const { authenticator } = require('otplib');

const ROOT_URL = 'https://apiconnect.angelone.in';
const ROUTES = {
  login: '/rest/auth/angelbroking/user/v1/loginByPassword',
  refresh: '/rest/auth/angelbroking/jwt/v1/generateTokens',
  ltp: '/rest/secure/angelbroking/order/v1/getLtpData',
  logout: '/rest/secure/angelbroking/user/v1/logout',
};

// Well-known NSE instrument tokens for the major indices (stable, published
// by Angel One / widely used in community sample code). For individual
// stocks you need the full instrument master file — see getSymbolToken().
const INSTRUMENT_TOKENS = {
  'NIFTY 50': { exchange: 'NSE', tradingsymbol: 'NIFTY', symboltoken: '99926000' },
  'BANK NIFTY': { exchange: 'NSE', tradingsymbol: 'BANKNIFTY', symboltoken: '99926009' },
  // SENSEX is a BSE instrument; Angel One's LTP feed for BSE indices can be
  // inconsistent via this endpoint — verify the token in your own account
  // (Instruments -> BSE -> SENSEX) before relying on it in production.
};

const INSTRUMENT_MASTER_URL =
  'https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json';

let session = null; // { jwtToken, refreshToken, feedToken, expiresAt }
let instrumentMasterCache = null; // lazy-loaded { "RELIANCE-EQ": {token, exchange}, ... }

function requiredEnv(name, aliases = []) {
  const candidates = [name, ...aliases];
  for (const key of candidates) {
    const v = process.env[key];
    if (v) return v;
  }
  throw new Error(`Missing required env var: ${name}. Check your .env file.`);
}

function baseHeaders() {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-UserType': 'USER',
    'X-SourceID': 'WEB',
    // These IP/MAC headers are required by Angel One's API but are not
    // meaningfully verified for server-to-server calls — placeholder
    // values are commonly used and accepted.
    'X-ClientLocalIP': '127.0.0.1',
    'X-ClientPublicIP': '127.0.0.1',
    'X-MACAddress': '00:00:00:00:00:00',
    'X-PrivateKey': requiredEnv('ANGEL_API_KEY', ['ANGELONE_API_KEY']),
  };
}

function isSessionValid() {
  return session && session.expiresAt > Date.now();
}

async function login() {
  const clientcode = requiredEnv('ANGEL_CLIENT_CODE', ['ANGELONE_CLIENT_CODE']);
  const password = requiredEnv('ANGEL_MPIN', ['ANGELONE_MPIN']);
  const totpSecret = requiredEnv('ANGEL_TOTP_SECRET', ['ANGELONE_TOTP_SECRET']);
  const totp = authenticator.generate(totpSecret);

  const { data } = await axios.post(
    ROOT_URL + ROUTES.login,
    { clientcode, password, totp },
    { headers: baseHeaders(), timeout: 10000 }
  );

  if (!data || data.status !== true || !data.data || !data.data.jwtToken) {
    const msg = data && data.message ? data.message : 'Unknown Angel One login failure';
    const code = data && data.errorcode ? ` (${data.errorcode})` : '';
    throw new Error(`Angel One login failed: ${msg}${code}`);
  }

  // Angel One sessions are valid until midnight IST regardless of when
  // they were created; we conservatively treat them as good for 6 hours
  // and re-login proactively rather than tracking exact midnight expiry.
  session = {
    jwtToken: data.data.jwtToken,
    refreshToken: data.data.refreshToken,
    feedToken: data.data.feedToken,
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
  };
  return session;
}

async function ensureSession() {
  if (!isSessionValid()) await login();
  return session;
}

async function getLtp({ exchange, tradingsymbol, symboltoken }) {
  const s = await ensureSession();
  try {
    const { data } = await axios.post(
      ROOT_URL + ROUTES.ltp,
      { exchange, tradingsymbol, symboltoken },
      {
        headers: { ...baseHeaders(), Authorization: `Bearer ${s.jwtToken}` },
        timeout: 10000,
      }
    );
    if (!data || data.status !== true || !data.data) {
      throw new Error((data && data.message) || 'getLtpData returned no data');
    }
    return data.data; // { exchange, tradingsymbol, symboltoken, ltp, ... }
  } catch (err) {
    // Session may have expired server-side even though our local clock
    // thought it was fine — retry once with a forced fresh login.
    if (err.response && err.response.status === 401) {
      await login();
      return getLtp({ exchange, tradingsymbol, symboltoken });
    }
    throw err;
  }
}

async function getIndexQuote(name) {
  const inst = INSTRUMENT_TOKENS[name];
  if (!inst) throw new Error(`No instrument token configured for "${name}"`);
  const data = await getLtp(inst);
  return { name, ltp: data.ltp, raw: data };
}

// Loads Angel One's full instrument master (large JSON, ~5-10MB) once and
// caches it in memory, so individual NSE equities can be looked up by
// trading symbol (e.g. "RELIANCE-EQ") without re-downloading every time.
async function loadInstrumentMaster() {
  if (instrumentMasterCache) return instrumentMasterCache;
  const { data } = await axios.get(INSTRUMENT_MASTER_URL, { timeout: 30000 });
  const map = {};
  for (const row of data) {
    if (row.exch_seg === 'NSE' && row.symbol && row.symbol.endsWith('-EQ')) {
      map[row.symbol] = { token: row.token, exchange: 'NSE', tradingsymbol: row.symbol };
    }
  }
  instrumentMasterCache = map;
  return map;
}

async function getStockQuote(sym) {
  const master = await loadInstrumentMaster();
  const key = `${sym}-EQ`;
  const inst = master[key];
  if (!inst) throw new Error(`Symbol "${sym}" not found in instrument master`);
  const data = await getLtp({
    exchange: inst.exchange,
    tradingsymbol: inst.tradingsymbol,
    symboltoken: inst.token,
  });
  return { sym, ltp: data.ltp, raw: data };
}

module.exports = {
  login,
  ensureSession,
  getLtp,
  getIndexQuote,
  getStockQuote,
  loadInstrumentMaster,
  INSTRUMENT_TOKENS,
};
