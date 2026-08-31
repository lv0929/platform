const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Watchlist = require('../models/Watchlist');

const router = express.Router();
router.use(requireAuth);

// GET /api/watchlists  -> { "My Stocks": [...], "Swing Trades": [...] }
router.get('/', async (req, res) => {
  const lists = await Watchlist.find({ userId: req.userId });
  const out = {};
  lists.forEach((l) => (out[l.name] = l.items));
  res.json(out);
});

// POST /api/watchlists  { name }
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  try {
    const list = await Watchlist.create({ userId: req.userId, name: name.trim(), items: [] });
    res.status(201).json(list);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'A watchlist with that name already exists' });
    throw err;
  }
});

// DELETE /api/watchlists/:name
router.delete('/:name', async (req, res) => {
  await Watchlist.deleteOne({ userId: req.userId, name: req.params.name });
  res.json({ ok: true });
});

// POST /api/watchlists/:name/items  { sym, price, chg, dir, signal, target }
router.post('/:name/items', async (req, res) => {
  const list = await Watchlist.findOne({ userId: req.userId, name: req.params.name });
  if (!list) return res.status(404).json({ error: 'Watchlist not found' });
  const sym = (req.body.sym || '').toUpperCase().trim();
  if (!sym) return res.status(400).json({ error: 'sym is required' });
  if (!list.items.some((i) => i.sym === sym)) {
    list.items.push({
      sym,
      price: req.body.price || '—',
      chg: req.body.chg || '0.00%',
      dir: req.body.dir || 'up',
      signal: req.body.signal || 'HOLD',
      target: req.body.target || null,
    });
    await list.save();
  }
  res.json(list);
});

// DELETE /api/watchlists/:name/items/:sym
router.delete('/:name/items/:sym', async (req, res) => {
  const list = await Watchlist.findOne({ userId: req.userId, name: req.params.name });
  if (!list) return res.status(404).json({ error: 'Watchlist not found' });
  list.items = list.items.filter((i) => i.sym !== req.params.sym.toUpperCase());
  await list.save();
  res.json(list);
});

module.exports = router;
