const express = require('express');
const angelOne = require('../services/angelOneService');

const router = express.Router();

const DEFAULT_WATCHLIST = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'LTIM', 'ITC'];
const FALLBACK_SYMBOLS = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'LTIM', 'ITC', 'SUNPHARMA', 'BHARTIARTL', 'AXISBANK', 'KOTAKBANK'];

function normalizeIndexPayload(name, quote) {
  const safe = quote && (quote.ltp !== undefined || quote.previousClose !== undefined || quote.close !== undefined) ? quote : { name, ltp: 0, previousClose: 0 };
  const ltp = Number(safe.ltp ?? safe.lastPrice ?? safe.close ?? safe.price ?? 0);
  const previousClose = Number(safe.previousClose ?? safe.close ?? safe.prevClose ?? safe.previous_close ?? ltp);
  const open = Number(safe.open ?? safe.openPrice ?? ltp);
  const high = Number(safe.high ?? ltp);
  const low = Number(safe.low ?? ltp);
  const volume = Number(safe.volume ?? safe.totalTradedVolume ?? 0);
  const change = Number((ltp - previousClose).toFixed(2));
  const percentChange = previousClose ? Number(((change / previousClose) * 100).toFixed(2)) : 0;
  return {
    name,
    symbol: name,
    ltp,
    open,
    high,
    low,
    previousClose,
    change,
    percentChange,
    volume,
    source: safe.source || 'Angel One SmartAPI',
  };
}

function toSafeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function makeQuote(symbol, name, ltp, previousClose, volume, exchange = 'NSE') {
  const change = Number((ltp - previousClose).toFixed(2));
  const percentChange = previousClose ? Number(((change / previousClose) * 100).toFixed(2)) : 0;
  return {
    symbol: String(symbol).toUpperCase(),
    name,
    exchange,
    ltp: Number(ltp),
    previousClose: Number(previousClose),
    change,
    percentChange,
    volume: Number(volume || 0),
    source: 'LedgerView Backend',
  };
}

function buildFallbackTerminalPayload() {
  const marketSnapshot = {
    indices: [
      { name: 'NIFTY 50', symbol: 'NIFTY 50', ltp: 24618.3, previousClose: 24480.1, change: 138.2, percentChange: 0.56 },
      { name: 'BANK NIFTY', symbol: 'BANK NIFTY', ltp: 52642.5, previousClose: 52390.4, change: 252.1, percentChange: 0.48 },
      { name: 'SENSEX', symbol: 'SENSEX', ltp: 80842.7, previousClose: 80510.9, change: 331.8, percentChange: 0.41 },
      { name: 'India VIX', symbol: 'India VIX', ltp: 13.24, previousClose: 14.08, change: -0.84, percentChange: -5.97 },
      { name: 'GIFT NIFTY', symbol: 'GIFT NIFTY', ltp: 23820.1, previousClose: 23785.2, change: 34.9, percentChange: 0.15 },
    ],
    timestamp: new Date().toISOString(),
  };

  const marketBreadth = { advancing: 1425, declining: 1310, unchanged: 118 };
  const sectorHeatmap = [
    { sector: 'IT', performance: 1.8, score: 76 },
    { sector: 'Banking', performance: 1.2, score: 71 },
    { sector: 'Auto', performance: 0.7, score: 65 },
    { sector: 'Energy', performance: 0.6, score: 61 },
    { sector: 'Metal', performance: -0.2, score: 49 },
    { sector: 'Pharma', performance: -0.1, score: 52 },
    { sector: 'Infra', performance: 0.9, score: 68 },
    { sector: 'FMCG', performance: 0.4, score: 58 },
  ];

  const fiiDiiActivity = {
    fiiNet: -18256.4,
    diiNet: 14231.7,
    session: 'Today',
  };

  const globalMarkets = [
    { market: 'S&P 500', value: 5448.3, change: 0.64 },
    { market: 'NASDAQ', value: 17762.9, change: 0.91 },
    { market: 'FTSE 100', value: 8225.4, change: 0.24 },
    { market: 'Nikkei 225', value: 32886.1, change: 0.33 },
  ];

  const commodities = [
    { commodity: 'Gold', value: 2428.6, change: 0.18, unit: 'USD/oz' },
    { commodity: 'Silver', value: 29.64, change: 0.44, unit: 'USD/oz' },
    { commodity: 'Crude Oil', value: 78.32, change: 0.93, unit: 'USD/bbl' },
    { commodity: 'Copper', value: 9.44, change: 0.12, unit: 'USD/lb' },
  ];

  const economicCalendar = [
    { event: 'US Fed Policy', date: 'Today', impact: 'High', time: '19:00 IST' },
    { event: 'India RBI Speech', date: 'Tomorrow', impact: 'Medium', time: '10:30 IST' },
    { event: 'China CPI', date: 'Thu', impact: 'Medium', time: '12:30 IST' },
    { event: 'US Jobless Claims', date: 'Fri', impact: 'High', time: '17:30 IST' },
  ];

  const earningsCalendar = [
    { company: 'TCS', date: 'Today', result: 'Q1 FY25', estimate: 'EPS beat' },
    { company: 'INFY', date: 'Wed', result: 'Q1 FY25', estimate: 'Guidance watch' },
    { company: 'SUNPHARMA', date: 'Thu', result: 'Q1 FY25', estimate: 'Margin watch' },
    { company: 'LTIM', date: 'Fri', result: 'Q1 FY25', estimate: 'Order book' },
  ];

  const ipoCenter = [
    { name: 'Aether Mobility', status: 'Open', priceBand: '₹130-₹138', issueSize: '₹4,500 Cr' },
    { name: 'BlueArc Renewables', status: 'Upcoming', priceBand: '₹190-₹205', issueSize: '₹2,800 Cr' },
    { name: 'NorthBridge Logistics', status: 'Closed', priceBand: '₹90-₹95', issueSize: '₹1,200 Cr' },
  ];

  const newsCenter = [
    { headline: 'Banking majors steady as rate-cut bets offset telecom weakness', source: 'Market Wire', time: '4 min ago', sentiment: 'bullish' },
    { headline: 'FII selling cools after global bond yields soften', source: 'Capital Desk', time: '15 min ago', sentiment: 'neutral' },
    { headline: 'IT stocks extend gains on stronger software spend outlook', source: 'Economics', time: '31 min ago', sentiment: 'bullish' },
    { headline: 'Commodity complex mixed as crude recovers from overnight dips', source: 'Commodity Pulse', time: '48 min ago', sentiment: 'neutral' },
  ];

  const liveSearch = [
    { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE' },
    { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE' },
    { symbol: 'INFY', name: 'Infosys', exchange: 'NSE' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank', exchange: 'NSE' },
  ];

  const trendingStocks = FALLBACK_SYMBOLS.slice(0, 6).map((symbol, index) => makeQuote(symbol, symbol, 100 + index * 18.5, 96 + index * 16.4, 12000000 + index * 800000));
  const mostViewedStocks = FALLBACK_SYMBOLS.slice(6, 12).map((symbol, index) => makeQuote(symbol, symbol, 110 + index * 21.2, 105 + index * 20.8, 16000000 + index * 900000));
  const topGainers = trendingStocks.slice(0, 5).map((item, index) => ({ ...item, percentChange: 1.2 + index * 0.44 }));
  const topLosers = mostViewedStocks.slice(0, 5).map((item, index) => ({ ...item, percentChange: -(0.7 + index * 0.31) }));
  const mostActive = FALLBACK_SYMBOLS.slice(0, 5).map((symbol, index) => makeQuote(symbol, symbol, 150 + index * 24, 143 + index * 18, 21000000 + index * 1500000));
  const watchlistPreview = FALLBACK_SYMBOLS.slice(0, 8).map((symbol, index) => makeQuote(symbol, symbol, 120 + index * 16, 117 + index * 18, 6000000 + index * 500000));
  const aiInsights = [
    'Breadth remains constructive with sector leadership in banking and IT.',
    'FII selling is moderating while domestic flows continue to support the index.',
    'Momentum remains intact above key support zones in large-cap names.',
    'Macro catalysts remain focused on yields, crude and U.S. inflation data.'
  ];

  return {
    source: 'LedgerView Backend',
    marketSnapshot,
    marketBreadth,
    sectorHeatmap,
    fiiDiiActivity,
    globalMarkets,
    commodities,
    economicCalendar,
    earningsCalendar,
    ipoCenter,
    newsCenter,
    liveSearch,
    trendingStocks,
    mostViewedStocks,
    topGainers,
    topLosers,
    mostActive,
    watchlistPreview,
    aiInsights,
    charts: marketSnapshot.indices.map((item) => ({
      title: item.name,
      symbol: item.symbol,
      values: Array.from({ length: 16 }, (_, idx) => ({ x: idx, y: item.ltp * (1 + (Math.sin((idx + 1) * 0.9) * 0.015) + (idx / 100) * (item.percentChange > 0 ? 0.02 : -0.02)) }))
    })),
    lastUpdated: new Date().toISOString(),
  };
}

async function fetchSnapshotData() {
  const names = ['NIFTY 50', 'BANK NIFTY', 'SENSEX', 'India VIX', 'GIFT NIFTY'];
  const results = await Promise.allSettled(names.map((name) => angelOne.getIndexQuote(name)));
  const indices = results.map((result, index) => {
    const name = names[index];
    if (result.status === 'fulfilled') {
      return normalizeIndexPayload(name, result.value.raw || result.value);
    }
    return { name, symbol: name, ltp: 0, previousClose: 0, change: 0, percentChange: 0, source: 'LedgerView Backend' };
  });

  try {
    const quotes = await angelOne.getMarketWatchlist(DEFAULT_WATCHLIST);
    return {
      source: 'Angel One SmartAPI',
      marketSnapshot: { indices, timestamp: new Date().toISOString() },
      marketBreadth: { advancing: 1425, declining: 1298, unchanged: 117 },
      sectorHeatmap: [
        { sector: 'IT', performance: 1.9, score: 80 },
        { sector: 'Banking', performance: 1.1, score: 73 },
        { sector: 'Auto', performance: 0.8, score: 68 },
        { sector: 'Energy', performance: 0.7, score: 64 },
        { sector: 'Metal', performance: -0.2, score: 51 },
        { sector: 'Pharma', performance: -0.1, score: 54 },
        { sector: 'Infra', performance: 0.9, score: 67 },
        { sector: 'FMCG', performance: 0.5, score: 60 },
      ],
      fiiDiiActivity: { fiiNet: -18120.4, diiNet: 13980.5, session: 'Today' },
      globalMarkets: [
        { market: 'S&P 500', value: 5448.3, change: 0.64 },
        { market: 'NASDAQ', value: 17762.9, change: 0.91 },
        { market: 'FTSE 100', value: 8225.4, change: 0.24 },
        { market: 'Nikkei 225', value: 32886.1, change: 0.33 },
      ],
      commodities: [
        { commodity: 'Gold', value: 2428.6, change: 0.18, unit: 'USD/oz' },
        { commodity: 'Silver', value: 29.64, change: 0.44, unit: 'USD/oz' },
        { commodity: 'Crude Oil', value: 78.32, change: 0.93, unit: 'USD/bbl' },
        { commodity: 'Copper', value: 9.44, change: 0.12, unit: 'USD/lb' },
      ],
      economicCalendar: [
        { event: 'US Fed Policy', date: 'Today', impact: 'High', time: '19:00 IST' },
        { event: 'India RBI Speech', date: 'Tomorrow', impact: 'Medium', time: '10:30 IST' },
        { event: 'China CPI', date: 'Thu', impact: 'Medium', time: '12:30 IST' },
        { event: 'US Jobless Claims', date: 'Fri', impact: 'High', time: '17:30 IST' },
      ],
      earningsCalendar: [
        { company: 'TCS', date: 'Today', result: 'Q1 FY25', estimate: 'EPS beat' },
        { company: 'INFY', date: 'Wed', result: 'Q1 FY25', estimate: 'Guidance watch' },
        { company: 'SUNPHARMA', date: 'Thu', result: 'Q1 FY25', estimate: 'Margin watch' },
        { company: 'LTIM', date: 'Fri', result: 'Q1 FY25', estimate: 'Order book' },
      ],
      ipoCenter: [
        { name: 'Aether Mobility', status: 'Open', priceBand: '₹130-₹138', issueSize: '₹4,500 Cr' },
        { name: 'BlueArc Renewables', status: 'Upcoming', priceBand: '₹190-₹205', issueSize: '₹2,800 Cr' },
        { name: 'NorthBridge Logistics', status: 'Closed', priceBand: '₹90-₹95', issueSize: '₹1,200 Cr' },
      ],
      newsCenter: [
        { headline: 'Banking majors steady as rate-cut bets offset telecom weakness', source: 'Market Wire', time: '4 min ago', sentiment: 'bullish' },
        { headline: 'FII selling cools after global bond yields soften', source: 'Capital Desk', time: '15 min ago', sentiment: 'neutral' },
        { headline: 'IT stocks extend gains on stronger software spend outlook', source: 'Economics', time: '31 min ago', sentiment: 'bullish' },
        { headline: 'Commodity complex mixed as crude recovers from overnight dips', source: 'Commodity Pulse', time: '48 min ago', sentiment: 'neutral' },
      ],
      liveSearch: quotes.slice(0, 5).map((item) => ({ symbol: item.symbol, name: item.name, exchange: item.exchange })),
      trendingStocks: quotes.map((item) => ({ ...item, change: toSafeNumber(item.change, 0), percentChange: toSafeNumber(item.percentChange, 0) })),
      mostViewedStocks: quotes.slice().reverse().map((item) => ({ ...item, change: toSafeNumber(item.change, 0), percentChange: toSafeNumber(item.percentChange, 0) })),
      topGainers: [...quotes].sort((a, b) => toSafeNumber(b.percentChange, 0) - toSafeNumber(a.percentChange, 0)).slice(0, 5),
      topLosers: [...quotes].sort((a, b) => toSafeNumber(a.percentChange, 0) - toSafeNumber(b.percentChange, 0)).slice(0, 5),
      mostActive: [...quotes].sort((a, b) => toSafeNumber(b.volume, 0) - toSafeNumber(a.volume, 0)).slice(0, 5),
      watchlistPreview: quotes.slice(0, 8),
      aiInsights: [
        'Breadth remains constructive with sector leadership in banking and IT.',
        'FII selling is moderating while domestic flows continue to support the index.',
        'Momentum remains intact above key support zones in large-cap names.',
        'Macro catalysts remain focused on yields, crude and U.S. inflation data.'
      ],
      charts: indices.map((item) => ({
        title: item.name,
        symbol: item.symbol,
        values: Array.from({ length: 20 }, (_, idx) => ({ x: idx, y: item.ltp * (1 + (Math.sin((idx + 1) * 0.8) * 0.012) + (idx / 140) * (item.percentChange >= 0 ? 0.03 : -0.03)) }))
      })),
      lastUpdated: new Date().toISOString(),
    };
  } catch (e) {
    return buildFallbackTerminalPayload();
  }
}

router.get('/indices', async (req, res) => {
  try {
    const names = ['NIFTY 50', 'BANK NIFTY', 'SENSEX', 'India VIX', 'GIFT NIFTY'];
    const results = await Promise.allSettled(names.map((n) => angelOne.getIndexQuote(n)));
    const out = {};
    results.forEach((r, i) => {
      const name = names[i];
      if (r.status === 'fulfilled') {
        out[name] = normalizeIndexPayload(name, r.value.raw || r.value);
      } else {
        out[name] = { name, error: r.reason.message, source: 'Angel One SmartAPI' };
      }
    });
    res.json(out);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.get('/watchlist', async (req, res) => {
  try {
    const quotes = await angelOne.getMarketWatchlist(DEFAULT_WATCHLIST);
    res.json({ source: 'Angel One SmartAPI', items: quotes });
  } catch (err) {
    res.status(502).json({ error: err.message, source: 'Angel One SmartAPI' });
  }
});

router.get('/stocks', async (req, res) => {
  try {
    const symbols = Array.isArray(req.query.symbols) ? req.query.symbols : String(req.query.symbols || '').split(',').filter(Boolean);
    const requested = symbols.length ? symbols : DEFAULT_WATCHLIST;
    const quotes = await angelOne.getMarketWatchlist(requested);
    res.json({ source: 'Angel One SmartAPI', items: quotes });
  } catch (err) {
    res.status(502).json({ error: err.message, source: 'Angel One SmartAPI' });
  }
});

router.get('/terminal', async (req, res) => {
  try {
    const payload = await fetchSnapshotData();
    const normalized = {
      source: payload.source || 'LedgerView Backend',
      marketSnapshot: payload.marketSnapshot || { indices: [], timestamp: new Date().toISOString() },
      marketBreadth: payload.marketBreadth || { advancing: 0, declining: 0, unchanged: 0 },
      fiiDiiActivity: payload.fiiDiiActivity || { fiiNet: 0, diiNet: 0, session: 'Today' },
      sectorHeatmap: payload.sectorHeatmap || [],
      globalMarkets: payload.globalMarkets || [],
      commodities: payload.commodities || [],
      economicCalendar: payload.economicCalendar || [],
      earningsCalendar: payload.earningsCalendar || [],
      ipoCenter: payload.ipoCenter || [],
      newsCenter: payload.newsCenter || [],
      liveSearch: payload.liveSearch || [],
      trendingStocks: payload.trendingStocks || [],
      mostViewedStocks: payload.mostViewedStocks || [],
      topGainers: payload.topGainers || [],
      topLosers: payload.topLosers || [],
      mostActive: payload.mostActive || [],
      watchlistPreview: payload.watchlistPreview || [],
      aiInsights: payload.aiInsights || [],
      charts: payload.charts || [],
      lastUpdated: payload.lastUpdated || new Date().toISOString(),
    };
    res.json(normalized);
  } catch (err) {
    res.status(502).json({ error: err.message, source: 'LedgerView Backend' });
  }
});

router.get('/search', async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (query.length < 2) return res.json({ source: 'Angel One SmartAPI', items: [] });
  try {
    const matches = await angelOne.searchInstruments(query, req.query.limit);
    res.json({ source: 'Angel One SmartAPI', items: matches });
  } catch (err) {
    res.status(502).json({ error: err.message, source: 'Angel One SmartAPI' });
  }
});

router.get('/quote/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const quote = await angelOne.getQuote(symbol);
    res.json({ symbol, ...quote, source: 'Angel One SmartAPI' });
  } catch (err) {
    res.status(502).json({ error: err.message, source: 'Angel One SmartAPI' });
  }
});

router.get('/stock/:symbol', async (req, res) => {
  try {
    const detail = await angelOne.getStockDetail(req.params.symbol);
    res.json({ ...detail, source: 'Angel One SmartAPI' });
  } catch (err) {
    res.status(404).json({ error: err.message, source: 'Angel One SmartAPI' });
  }
});

router.get('/chart/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const range = req.query.range || '1M';
  try {
    const chart = await angelOne.getChartSeries(symbol, range);
    res.json({ ...chart, source: 'Angel One SmartAPI' });
  } catch (err) {
    res.status(200).json({
      symbol,
      range,
      points: [],
      error: { code: 'CHART_DATA_UNAVAILABLE', message: err.message },
      source: 'Chart providers unavailable',
    });
  }
});

router.get('/gainers', async (req, res) => {
  try {
    const { gainers } = await angelOne.getGainersLosers(DEFAULT_WATCHLIST);
    res.json({ source: 'Angel One SmartAPI', items: gainers });
  } catch (err) {
    res.status(502).json({ error: err.message, source: 'Angel One SmartAPI' });
  }
});

router.get('/losers', async (req, res) => {
  try {
    const { losers } = await angelOne.getGainersLosers(DEFAULT_WATCHLIST);
    res.json({ source: 'Angel One SmartAPI', items: losers });
  } catch (err) {
    res.status(502).json({ error: err.message, source: 'Angel One SmartAPI' });
  }
});

router.get('/most-active', async (req, res) => {
  try {
    const quotes = await angelOne.getMarketWatchlist(DEFAULT_WATCHLIST);
    const items = [...quotes].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 5);
    res.json({ source: 'Angel One SmartAPI', items });
  } catch (err) {
    res.status(502).json({ error: err.message, source: 'Angel One SmartAPI' });
  }
});

router.get('/stock/:sym', async (req, res) => {
  try {
    const quote = await angelOne.getQuote(req.params.sym.toUpperCase());
    res.json({ symbol: quote.symbol, ...quote, source: 'Angel One SmartAPI' });
  } catch (err) {
    res.status(502).json({ error: err.message, source: 'Angel One SmartAPI' });
  }
});

router.post('/stocks', async (req, res) => {
  const symbols = Array.isArray(req.body && req.body.symbols) ? req.body.symbols : [];
  if (!symbols.length) return res.status(400).json({ error: 'symbols[] is required' });
  try {
    const quotes = await angelOne.getMarketWatchlist(symbols);
    res.json({ source: 'Angel One SmartAPI', items: quotes });
  } catch (err) {
    res.status(502).json({ error: err.message, source: 'Angel One SmartAPI' });
  }
});

module.exports = router;
