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

const INDEX_CONFIG = {
  'NIFTY 50': { exchange: 'NSE', tradingsymbol: 'NIFTY', symboltoken: '26000', aliases: ['NIFTY50', 'NIFTY'] },
  'BANK NIFTY': { exchange: 'NSE', tradingsymbol: 'BANKNIFTY', symboltoken: '26009', aliases: ['BANKNIFTY'] },
  'India VIX': { exchange: 'NSE', tradingsymbol: 'INDIAVIX', symboltoken: '26017', aliases: ['INDIAVIX', 'INDIA VIX', 'VIX'] },
  SENSEX: { exchange: 'BSE', tradingsymbol: 'SENSEX', symboltoken: '500010', aliases: ['BSESENSEX'] },
  'GIFT NIFTY': { exchange: 'NFO', tradingsymbol: 'GIFTNIFTY', symboltoken: '26075', aliases: ['GIFTNIFTY'] },
};

const INSTRUMENT_TOKENS = {
  ...INDEX_CONFIG,
  NIFTY: { exchange: 'NSE', tradingsymbol: 'NIFTY', symboltoken: '26000' },
  BANKNIFTY: { exchange: 'NSE', tradingsymbol: 'BANKNIFTY', symboltoken: '26009' },
  RELIANCE: { exchange: 'NSE', tradingsymbol: 'RELIANCE-EQ', symboltoken: '2885' },
  HDFCBANK: { exchange: 'NSE', tradingsymbol: 'HDFCBANK-EQ', symboltoken: '1335' },
  ICICIBANK: { exchange: 'NSE', tradingsymbol: 'ICICIBANK-EQ', symboltoken: '4963' },
  TCS: { exchange: 'NSE', tradingsymbol: 'TCS-EQ', symboltoken: '11536' },
};

const SECONDARY_CHART_TICKERS = {
  NIFTY: '^NSEI',
  BANKNIFTY: '^NSEBANK',
  RELIANCE: 'RELIANCE.NS',
  HDFCBANK: 'HDFCBANK.NS',
};

function normalizeIndexName(name) {
  const raw = String(name || '').trim();
  if (!raw) return null;

  const compact = raw.toUpperCase().replace(/[\s\-_]+/g, '');
  for (const [label, config] of Object.entries(INDEX_CONFIG)) {
    const labelKey = label.toUpperCase().replace(/[\s\-_]+/g, '');
    if (labelKey === compact) return label;
    if ((config.aliases || []).some((alias) => alias.toUpperCase().replace(/[\s\-_]+/g, '') === compact)) return label;
  }

  return raw;
}

function resolveIndexConfig(name) {
  const label = normalizeIndexName(name);
  const resolved = label ? INDEX_CONFIG[label] : null;
  if (resolved) {
    return { name: label, ...resolved };
  }

  const fallback = Object.entries(INDEX_CONFIG).find(([_, config]) => {
    const aliases = [...(config.aliases || []), _];
    return aliases.some((alias) => String(alias).toUpperCase().replace(/[\s\-_]+/g, '') === String(name || '').toUpperCase().replace(/[\s\-_]+/g, ''));
  });

  return fallback ? { name: fallback[0], ...fallback[1] } : null;
}

function getSecondaryIndexTicker(name) {
  const label = normalizeIndexName(name);
  const map = {
    SENSEX: '^BSESN',
    'India VIX': '^VIX',
    'INDIA VIX': '^VIX',
  };
  return map[label] || map[String(name || '').trim()] || null;
}

async function fetchSecondaryIndexQuote(name) {
  const ticker = getSecondaryIndexTicker(name);
  if (!ticker) return null;

  try {
    const { data } = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1d&interval=1m`, { timeout: 10000 });
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta || {};
    const quote = result.indicators?.quote?.[0] || {};
    const closes = Array.isArray(quote.close) ? quote.close.filter((value) => Number.isFinite(Number(value))) : [];
    const opens = Array.isArray(quote.open) ? quote.open.filter((value) => Number.isFinite(Number(value))) : [];
    const highs = Array.isArray(quote.high) ? quote.high.filter((value) => Number.isFinite(Number(value))) : [];
    const lows = Array.isArray(quote.low) ? quote.low.filter((value) => Number.isFinite(Number(value))) : [];
    const volumes = Array.isArray(quote.volume) ? quote.volume.filter((value) => Number.isFinite(Number(value))) : [];
    const ltp = Number(meta.regularMarketPrice ?? closes[closes.length - 1] ?? 0);
    const previousClose = Number(meta.previousClose ?? closes[closes.length - 2] ?? ltp);
    const open = Number(meta.regularMarketOpen ?? opens[opens.length - 1] ?? ltp);
    const high = Number(meta.regularMarketDayHigh ?? (highs.length ? Math.max(...highs) : ltp));
    const low = Number(meta.regularMarketDayLow ?? (lows.length ? Math.min(...lows) : ltp));
    const volume = Number(meta.regularMarketVolume ?? (volumes.length ? volumes[volumes.length - 1] : 0));

    return {
      name: normalizeIndexName(name) || String(name).trim(),
      symbol: normalizeIndexName(name) || String(name).trim(),
      exchange: 'NSE',
      token: null,
      ltp,
      open,
      high,
      low,
      previousClose,
      volume,
      raw: { source: 'secondary-market-adapter', ticker, meta, quote },
    };
  } catch (error) {
    return null;
  }
}

function normalizeChartSymbol(symbol) {
  const raw = String(symbol || '').trim();
  if (!raw) return null;

  const normalizeLookupKey = (value) => String(value || '')
    .toUpperCase()
    .replace(/-EQ$/, '')
    .replace(/[\s\-_]+/g, ' ')
    .trim();

  const key = normalizeLookupKey(raw);
  const direct = INSTRUMENT_TOKENS[key];
  if (direct) {
    return {
      symbol: key,
      exchange: direct.exchange,
      tradingsymbol: direct.tradingsymbol,
      symboltoken: String(direct.symboltoken),
      token: String(direct.symboltoken),
    };
  }

  const matched = Object.entries(INSTRUMENT_TOKENS).find(([candidate, config]) => {
    const candidateKey = normalizeLookupKey(candidate);
    const tradingKey = normalizeLookupKey(config.tradingsymbol || '');
    const aliasMatches = Array.isArray(config.aliases)
      ? config.aliases.some((alias) => normalizeLookupKey(alias) === key)
      : false;
    return candidateKey === key || tradingKey === key || aliasMatches;
  });

  if (matched) {
    const [symbolName, config] = matched;
    return {
      symbol: symbolName,
      exchange: config.exchange,
      tradingsymbol: config.tradingsymbol,
      symboltoken: String(config.symboltoken),
      token: String(config.symboltoken),
    };
  }

  return null;
}

function mapCandleInterval(range) {
  const normalized = String(range || '1M').trim().toUpperCase();
  const mapping = {
    '1D': 'ONE_MINUTE',
    '1W': 'ONE_HOUR',
    '1M': 'ONE_DAY',
    '3M': 'ONE_DAY',
    '1Y': 'ONE_DAY',
  };
  return mapping[normalized] || 'ONE_DAY';
}

const INSTRUMENT_MASTER_URL = 'https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json';

let session = null;
let instrumentMasterCache = null;
let instrumentMasterLoad = null;

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
  const inst = resolveIndexConfig(name);
  if (!inst) throw new Error(`No instrument token configured for "${name}"`);

  try {
    const data = await getLtp({ exchange: inst.exchange, tradingsymbol: inst.tradingsymbol, symboltoken: inst.symboltoken });
    const previousClose = Number(data.close ?? data.previousClose ?? data.prevClose ?? data.ltp ?? 0);
    const open = Number(data.open ?? data.ltp ?? previousClose);
    const high = Number(data.high ?? data.ltp ?? previousClose);
    const low = Number(data.low ?? data.ltp ?? previousClose);
    const volume = Number(data.volume ?? data.totalTradedVolume ?? 0);
    return {
      name: inst.name,
      symbol: inst.name,
      exchange: inst.exchange,
      token: String(inst.symboltoken),
      ltp: Number(data.ltp ?? 0),
      open,
      high,
      low,
      previousClose,
      volume,
      change: Number(((Number(data.ltp ?? 0) - previousClose)).toFixed(2)),
      percentChange: previousClose ? Number((((Number(data.ltp ?? 0) - previousClose) / previousClose) * 100).toFixed(2)) : 0,
      raw: data,
    };
  } catch (error) {
    const fallback = await fetchSecondaryIndexQuote(name);
    if (fallback) return fallback;
    throw error;
  }
}

async function loadInstrumentMaster() {
  if (instrumentMasterCache) return instrumentMasterCache;
  if (instrumentMasterLoad) return instrumentMasterLoad;
  instrumentMasterLoad = axios.get(INSTRUMENT_MASTER_URL, { timeout: 30000 })
    .then(({ data }) => {
      if (!Array.isArray(data)) throw new Error('Angel One instrument master returned an invalid payload');
      const universe = [];
      for (const row of data) {
        if (!['NSE', 'BSE'].includes(row.exch_seg) || !row.symbol || !row.token) continue;
        const tradingsymbol = String(row.symbol).toUpperCase();
        const symbol = tradingsymbol.replace(/-EQ$/, '');
        universe.push({
          symbol,
          name: row.name || row.companyname || symbol,
          exchange: row.exch_seg,
          token: String(row.token),
          tradingsymbol,
        });
      }
      instrumentMasterCache = universe;
      console.log(`[market] Instrument universe loaded: ${universe.length} NSE/BSE symbols`);
      return universe;
    })
    .catch((error) => {
      instrumentMasterLoad = null;
      throw error;
    });
  return instrumentMasterLoad;
}

function findInstrument(universe, symbol) {
  const normalized = String(symbol || '').trim().toUpperCase();
  const exact = universe.find((instrument) => instrument.symbol === normalized || instrument.tradingsymbol === normalized);
  return exact || universe.find((instrument) => instrument.symbol === normalized.replace(/-EQ$/, ''));
}

async function searchInstruments(query, limit = 12) {
  const term = String(query || '').trim().toUpperCase();
  if (!term) return [];
  const universe = await loadInstrumentMaster();
  const filtered = universe
    .filter((instrument) => instrument.symbol.includes(term) || instrument.name.toUpperCase().includes(term))
    .slice(0, Math.min(Number(limit) || 12, 25));

  const items = await Promise.all(filtered.map(async (instrument) => {
    try {
      const quote = await getQuote(instrument.symbol);
      return {
        symbol: quote.symbol,
        name: quote.name || instrument.name,
        exchange: quote.exchange || instrument.exchange,
        price: quote.ltp,
        volume: quote.volume,
        marketCap: quote.marketCap,
        casScore: quote.casScore,
        token: quote.token || instrument.token,
      };
    } catch (error) {
      return {
        symbol: instrument.symbol,
        name: instrument.name,
        exchange: instrument.exchange,
        price: null,
        volume: null,
        marketCap: null,
        casScore: null,
        token: instrument.token,
      };
    }
  }));

  return items;
}

async function getStockQuote(sym) {
  const universe = await loadInstrumentMaster();
  const inst = findInstrument(universe, sym);
  if (!inst) throw new Error(`Symbol "${sym}" not found in NSE/BSE instrument master`);
  const data = await getLtp({
    exchange: inst.exchange,
    tradingsymbol: inst.tradingsymbol,
    symboltoken: inst.token,
  });
  return { sym: inst.symbol, name: inst.name, exchange: inst.exchange, token: inst.token, ltp: data.ltp, previousClose: data.close || data.previousClose || data.ltp, raw: data };
}

function toSafeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getFallbackMarketCap(symbol, ltp, volume) {
  const safeSymbol = String(symbol || '').toUpperCase();
  const fallbackCaps = {
    RELIANCE: 1.9e12,
    TCS: 1.5e12,
    INFY: 8.2e11,
    HDFCBANK: 1.1e12,
    ICICIBANK: 8.8e11,
    SBIN: 1.4e12,
    LTIM: 3.8e11,
    ITC: 6.3e11,
  };
  if (fallbackCaps[safeSymbol]) return Number(fallbackCaps[safeSymbol]);
  if (!ltp) return null;
  const normalizedVolume = Number(volume) || 1000000;
  return Number((ltp * normalizedVolume * 5).toFixed(2));
}

function getFallbackCasScore(symbol, ltp, volume, previousClose) {
  const safeSymbol = String(symbol || '').toUpperCase();
  if (safeSymbol && /NIFTY|BANKNIFTY|SENSEX|INDIAVIX|GIFT/.test(safeSymbol)) return 72;
  const base = 50 + (Number(ltp || 0) / 500) + (Number(volume || 0) / 5000000);
  const changeBias = previousClose ? ((Number(ltp || 0) - Number(previousClose || 0)) / Number(previousClose || 1)) * 100 : 0;
  const score = Math.min(100, Math.max(0, base + changeBias * 0.5));
  return Number(score.toFixed(2));
}

function normalizeQuote(symbol, raw) {
  const ltp = toSafeNumber(raw?.ltp ?? raw?.lastPrice ?? raw?.close ?? raw?.price ?? raw?.last_traded_price, 0);
  const previousClose = toSafeNumber(raw?.close ?? raw?.previousClose ?? raw?.prevClose ?? ltp, ltp);
  const open = toSafeNumber(raw?.open ?? previousClose, previousClose);
  const high = toSafeNumber(raw?.high ?? ltp, ltp);
  const low = toSafeNumber(raw?.low ?? ltp, ltp);
  const volume = toSafeNumber(raw?.volume ?? raw?.totalTradedVolume ?? raw?.totalTradedQty ?? raw?.quantity ?? raw?.qty ?? raw?.tradeVolume ?? null, null);
  const marketCap = toSafeNumber(raw?.marketCap ?? raw?.marketcap ?? raw?.market_cap ?? getFallbackMarketCap(symbol, ltp, volume), null);
  const casScore = toSafeNumber(raw?.casScore ?? raw?.cas ?? raw?.score ?? getFallbackCasScore(symbol, ltp, volume, previousClose), 0);
  const change = Number((ltp - previousClose).toFixed(2));
  const percentChange = previousClose ? Number(((change / previousClose) * 100).toFixed(2)) : 0;
  return {
    name: raw?.name || raw?.companyName || null,
    symbol: String(symbol || raw?.tradingsymbol || raw?.symbol || '').toUpperCase(),
    exchange: raw?.exchange || raw?.exch_seg || null,
    token: raw?.token || raw?.symboltoken || null,
    ltp,
    change,
    percentChange,
    open,
    high,
    low,
    volume,
    previousClose,
    marketCap,
    casScore,
    raw,
  };
}

async function getQuote(symbol) {
  const quote = await getStockQuote(String(symbol).toUpperCase());
  return { ...normalizeQuote(symbol, quote.raw || quote), name: quote.name, exchange: quote.exchange, token: quote.token };
}

async function getStockDetail(symbol) {
  const quote = await getQuote(symbol);
  return {
    name: quote.name,
    symbol: quote.symbol,
    exchange: quote.exchange,
    ltp: quote.ltp,
    previousClose: quote.previousClose,
    open: quote.open,
    high: quote.high,
    low: quote.low,
    change: quote.change,
    percentChange: quote.percentChange,
    volume: quote.volume,
    marketCap: quote.marketCap ?? getFallbackMarketCap(quote.symbol, quote.ltp, quote.volume),
    casScore: quote.casScore ?? getFallbackCasScore(quote.symbol, quote.ltp, quote.volume, quote.previousClose),
    '52wHigh': null,
    '52wLow': null,
  };
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
  const normalized = String(symbol || '').trim().toUpperCase();
  const aliasInstrument = normalizeChartSymbol(normalized);
  const universe = await loadInstrumentMaster();
  const instrument = aliasInstrument || findInstrument(universe, normalized);

  if (!instrument) {
    throw new Error(`Symbol "${normalized}" not found in instrument master`);
  }

  const interval = mapCandleInterval(range);
  const days = { '1D': 1, '1W': 7, '1M': 31, '3M': 93, '1Y': 365 };
  const end = new Date();
  const start = new Date(end.getTime() - (days[String(range).trim().toUpperCase()] || 31) * 86400000);
  const format = (date) => date.toISOString().slice(0, 19).replace('T', ' ');
  const requestBody = {
    exchange: instrument.exchange,
    symboltoken: String(instrument.symboltoken || instrument.token),
    interval,
    fromdate: format(start),
    todate: format(end),
  };

  try {
    const sessionData = await ensureSession();
    const { data } = await axios.post(ROOT_URL + ROUTES.candles, requestBody, {
      headers: { ...baseHeaders(), Authorization: `Bearer ${sessionData.jwtToken}` },
      timeout: 15000,
    });

    if (!data || data.status !== true || !Array.isArray(data.data)) {
      throw new Error((data && data.message) || 'Historical chart data unavailable');
    }

    return {
      symbol: normalized,
      exchange: instrument.exchange,
      range,
      interval,
      points: data.data.map((row) => ({
        label: row[0],
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        value: Number(row[4]),
        volume: Number(row[5] || 0),
      })),
    };
  } catch (error) {
    const ticker = SECONDARY_CHART_TICKERS[normalized];
    if (!ticker) throw error;

    const yahooInterval = { '1D': '5m', '1W': '1h', '1M': '1d', '3M': '1d', '1Y': '1d' }[String(range).trim().toUpperCase()] || '1d';
    const period1 = Math.floor(start.getTime() / 1000);
    const period2 = Math.floor(end.getTime() / 1000);
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=${yahooInterval}&events=history`;
    const { data } = await axios.get(yahooUrl, { timeout: 15000 });
    const result = data?.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    if (!result || !quote || !Array.isArray(result.timestamp)) {
      throw new Error('Historical chart data unavailable from primary and secondary providers');
    }

    const points = result.timestamp.map((timestamp, index) => ({
      label: new Date(timestamp * 1000).toISOString().slice(0, 19).replace('T', ' '),
      open: Number(quote.open?.[index]),
      high: Number(quote.high?.[index]),
      low: Number(quote.low?.[index]),
      value: Number(quote.close?.[index]),
      volume: Number(quote.volume?.[index] || 0),
    })).filter((point) => [point.open, point.high, point.low, point.value].every(Number.isFinite));

    if (!points.length) throw new Error('Historical chart data unavailable from primary and secondary providers');
    return { symbol: normalized, exchange: instrument.exchange, range, interval, points };
  }
}

module.exports = {
  login,
  ensureSession,
  getLtp,
  getIndexQuote,
  getStockQuote,
  getStockDetail,
  searchInstruments,
  getQuote,
  getMarketWatchlist,
  getGainersLosers,
  getChartSeries,
  loadInstrumentMaster,
  INSTRUMENT_TOKENS,
  normalizeChartSymbol,
  mapCandleInterval,
  normalizeQuote,
};
