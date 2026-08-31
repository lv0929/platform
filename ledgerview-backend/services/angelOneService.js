// ============================================================
// Angel One SmartAPI client.
// ============================================================

const axios = require('axios');
const { authenticator } = require('otplib');

const ROOT_URL = 'https://apiconnect.angelone.in';
const ROUTES = {
  login: '/rest/auth/angelbroking/user/v1/loginByPassword',
  refresh: '/rest/auth/angelbroking/jwt/v1/generateTokens',
  ltp: '/rest/secure/angelbroking/order/v1/getLtpData',
  candles: '/rest/secure/angelbroking/historical/v1/getCandleData',
  logout: '/rest/secure/angelbroking/user/v1/logout',
};

const INSTRUMENT_TOKENS = {
  'NIFTY 50': { exchange: 'NSE', tradingsymbol: 'NIFTY', symboltoken: '99926000' },
  'BANK NIFTY': { exchange: 'NSE', tradingsymbol: 'BANKNIFTY', symboltoken: '99926009' },
  'India VIX': { exchange: 'NSE', tradingsymbol: 'INDIAVIX', symboltoken: '99926017' },
  SENSEX: { exchange: 'BSE', tradingsymbol: 'SENSEX', symboltoken: '500010' },
};

const INSTRUMENT_MASTER_URL = 'https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json';

let session = null;
let instrumentMasterCache = null;

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
    'X-ClientLocalIP': '127.0.0.1',
    'X-ClientPublicIP': '127.0.0.1',
    'X-MACAddress': '00:00:00:00:00:00',
    'X-PrivateKey': requiredEnv('ANGEL_API_KEY', ['ANGELONE_API_KEY']),
  };
}

function isSessionValid() {
  return Boolean(session && session.expiresAt && session.expiresAt > Date.now());
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
    return data.data;
  } catch (err) {
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
  return { name, ltp: data.ltp, previousClose: data.close || data.previousClose || data.ltp, raw: data };
}

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

async function searchInstruments(query, limit = 12) {
  const term = String(query || '').trim().toUpperCase();
  if (!term) return [];
  const master = await loadInstrumentMaster();
  return Object.values(master)
    .filter((instrument) => instrument.tradingsymbol.includes(term))
    .slice(0, Math.min(Number(limit) || 12, 25))
    .map((instrument) => ({
      symbol: instrument.tradingsymbol.replace(/-EQ$/, ''),
      companyName: instrument.tradingsymbol.replace(/-EQ$/, ''),
      exchange: instrument.exchange,
      token: instrument.token,
    }));
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
  return { sym, ltp: data.ltp, previousClose: data.close || data.previousClose || data.ltp, raw: data };
}

function toSafeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeQuote(symbol, raw) {
  const ltp = toSafeNumber(raw?.ltp ?? raw?.lastPrice ?? raw?.close ?? raw?.price ?? raw?.last_traded_price, 0);
  const previousClose = toSafeNumber(raw?.close ?? raw?.previousClose ?? raw?.prevClose ?? ltp, ltp);
  const open = toSafeNumber(raw?.open ?? previousClose, previousClose);
  const high = toSafeNumber(raw?.high ?? ltp, ltp);
  const low = toSafeNumber(raw?.low ?? ltp, ltp);
  const volume = toSafeNumber(raw?.volume ?? raw?.totalTradedVolume ?? raw?.quantity ?? 0, 0);
  const change = Number((ltp - previousClose).toFixed(2));
  const percentChange = previousClose ? Number(((change / previousClose) * 100).toFixed(2)) : 0;
  return {
    symbol: String(symbol || raw?.tradingsymbol || raw?.symbol || '').toUpperCase(),
    ltp,
    change,
    percentChange,
    open,
    high,
    low,
    volume,
    previousClose,
  };
}

async function getQuote(symbol) {
  const quote = await getStockQuote(String(symbol).toUpperCase());
  return normalizeQuote(symbol, quote.raw || quote);
}

async function getMarketWatchlist(symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'LTIM', 'ITC']) {
  const results = await Promise.allSettled(symbols.map(async (symbol) => {
    const quote = await getQuote(symbol);
    return quote;
  }));

  const items = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);

  return items;
}

async function getGainersLosers(symbols = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'LTIM', 'ITC', 'SUNPHARMA', 'BHARTIARTL']) {
  const quotes = await getMarketWatchlist(symbols);
  return {
    gainers: [...quotes].sort((a, b) => b.percentChange - a.percentChange).slice(0, 5),
    losers: [...quotes].sort((a, b) => a.percentChange - b.percentChange).slice(0, 5),
  };
}

async function getChartSeries(symbol, range = '1M') {
  const normalized = String(symbol || '').toUpperCase();
  const instrument = INSTRUMENT_TOKENS[normalized] || (await loadInstrumentMaster())[`${normalized}-EQ`];
  if (!instrument) throw new Error(`Symbol "${normalized}" not found in instrument master`);
  const intervals = { '1D': 'TEN_MINUTE', '1W': 'ONE_HOUR', '1M': 'ONE_DAY', '3M': 'ONE_DAY', '1Y': 'ONE_DAY' };
  const days = { '1D': 1, '1W': 7, '1M': 31, '3M': 93, '1Y': 365 };
  const end = new Date();
  const start = new Date(end.getTime() - (days[range] || 31) * 86400000);
  const format = (date) => date.toISOString().slice(0, 19).replace('T', ' ');
  const sessionData = await ensureSession();
  const { data } = await axios.post(ROOT_URL + ROUTES.candles, {
    exchange: instrument.exchange,
    symboltoken: instrument.symboltoken || instrument.token,
    interval: intervals[range] || 'ONE_DAY',
    fromdate: format(start),
    todate: format(end),
  }, { headers: { ...baseHeaders(), Authorization: `Bearer ${sessionData.jwtToken}` }, timeout: 15000 });
  if (!data || data.status !== true || !Array.isArray(data.data)) throw new Error((data && data.message) || 'Historical chart data unavailable');
  return {
    symbol: normalized,
    range,
    points: data.data.map(row => ({ label: row[0], open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), value: Number(row[4]), volume: Number(row[5] || 0) })),
  };
}

module.exports = {
  login,
  ensureSession,
  getLtp,
  getIndexQuote,
  getStockQuote,
  searchInstruments,
  getQuote,
  getMarketWatchlist,
  getGainersLosers,
  getChartSeries,
  loadInstrumentMaster,
  INSTRUMENT_TOKENS,
  normalizeQuote,
};
