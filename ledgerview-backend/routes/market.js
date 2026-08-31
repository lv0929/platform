const express = require('express');
const angelOne = require('../services/angelOneService');

const router = express.Router();

const DEFAULT_WATCHLIST = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'LTIM', 'ITC'];

function normalizeIndexPayload(name, quote) {
  const safe = quote && quote.ltp !== undefined ? quote : { name, ltp: 0, previousClose: 0 };
  const change = Number((safe.ltp - (safe.previousClose || safe.ltp || 0)).toFixed(2));
  const percentChange = safe.previousClose ? Number(((change / safe.previousClose) * 100).toFixed(2)) : 0;
  return {
    name,
    symbol: name,
    ltp: Number(safe.ltp || 0),
    previousClose: Number(safe.previousClose || 0),
    change,
    percentChange,
    source: 'Angel One SmartAPI',
  };
}

router.get('/indices', async (req, res) => {
  try {
    const names = ['NIFTY 50', 'BANK NIFTY', 'SENSEX', 'India VIX'];
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
  try {
    const symbol = req.params.symbol.toUpperCase();
    const range = req.query.range || '1M';
    const chart = await angelOne.getChartSeries(symbol, range);
    res.json({ ...chart, source: 'Angel One SmartAPI' });
  } catch (err) {
    res.status(502).json({ error: err.message, source: 'Angel One SmartAPI' });
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
