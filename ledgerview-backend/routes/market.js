const express = require('express');
const angelOne = require('../services/angelOneService');

const router = express.Router();

// GET /api/market/indices -> live NIFTY 50 / BANK NIFTY levels from Angel One
router.get('/indices', async (req, res) => {
  try {
    const names = Object.keys(angelOne.INSTRUMENT_TOKENS);
    const results = await Promise.allSettled(names.map((n) => angelOne.getIndexQuote(n)));
    const out = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') out[names[i]] = r.value;
      else out[names[i]] = { error: r.reason.message };
    });
    res.json(out);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/market/stock/:sym -> live LTP for one NSE equity, e.g. /api/market/stock/RELIANCE
router.get('/stock/:sym', async (req, res) => {
  try {
    const quote = await angelOne.getStockQuote(req.params.sym.toUpperCase());
    res.json(quote);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// POST /api/market/stocks  { symbols: ["RELIANCE","TCS", ...] } -> batch quotes
router.post('/stocks', async (req, res) => {
  const symbols = Array.isArray(req.body.symbols) ? req.body.symbols : [];
  if (!symbols.length) return res.status(400).json({ error: 'symbols[] is required' });
  const results = await Promise.allSettled(symbols.map((s) => angelOne.getStockQuote(s.toUpperCase())));
  const out = {};
  results.forEach((r, i) => {
    out[symbols[i].toUpperCase()] = r.status === 'fulfilled' ? r.value : { error: r.reason.message };
  });
  res.json(out);
});

module.exports = router;
