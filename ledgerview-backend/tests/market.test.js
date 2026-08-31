const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { normalizeChartSymbol, mapCandleInterval, normalizeQuote, getStockDetail } = require('../services/angelOneService');

process.env.PORT = '4104';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.CORS_ORIGIN = 'http://localhost:3000';

const { app } = require('../server');

let mongoServer;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(process.env.MONGODB_URI);
});

test.after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test('GET /api/market/indices returns object for index names', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/market/indices`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data['NIFTY 50'] || data['BANK NIFTY']);
  } finally {
    server.close();
  }
});

test('GET /api/market/terminal returns the market homepage payload', async () => {
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/market/terminal`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.ok(data.marketSnapshot);
    assert.ok(data.marketBreadth);
    assert.ok(data.sectorHeatmap);
    assert.ok(data.liveSearch);
    assert.ok(Array.isArray(data.topGainers));
    assert.ok(Array.isArray(data.aiInsights));
  } finally {
    server.close();
  }
});

test('chart symbol aliases and interval mapping are resolved for live Angel One requests', () => {
  assert.equal(normalizeChartSymbol('NIFTY').symbol, 'NIFTY');
  assert.equal(normalizeChartSymbol('NIFTY').token, '26000');
  assert.equal(normalizeChartSymbol('BANKNIFTY').exchange, 'NSE');
  assert.equal(normalizeChartSymbol('BANKNIFTY').token, '26009');
  assert.equal(normalizeChartSymbol('INDIA VIX')?.token, '26017');
  assert.equal(normalizeChartSymbol('SENSEX')?.token, '500010');
  assert.equal(normalizeChartSymbol('GIFTNIFTY')?.symbol, 'GIFT NIFTY');
  assert.equal(normalizeChartSymbol('GIFTNIFTY')?.token, '26075');
  assert.equal(normalizeChartSymbol('RELIANCE').token, '2885');
  assert.equal(normalizeChartSymbol('HDFCBANK').token, '1335');
  assert.equal(normalizeChartSymbol('ICICIBANK').token, '4963');
  assert.equal(normalizeChartSymbol('TCS').token, '11536');
  assert.equal(mapCandleInterval('1D'), 'ONE_MINUTE');
  assert.equal(mapCandleInterval('1W'), 'ONE_HOUR');
  assert.equal(mapCandleInterval('1M'), 'ONE_DAY');
  assert.equal(mapCandleInterval('3M'), 'ONE_DAY');
  assert.equal(mapCandleInterval('1Y'), 'ONE_DAY');
});

test('real quote volume is preserved and stock detail exposes live metrics and CAS fallback', () => {
  const quote = normalizeQuote('RELIANCE', {
    symbol: 'RELIANCE',
    exchange: 'NSE',
    token: '2885',
    ltp: 1287,
    close: 1282.2,
    open: 1279.5,
    high: 1291.8,
    low: 1280,
    volume: 4567890,
    name: 'Reliance Industries',
  });

  assert.equal(quote.volume, 4567890);
  assert.ok(quote.volume > 0);
  assert.equal(quote.previousClose, 1282.2);
  assert.ok(typeof quote.percentChange === 'number');

  const detail = {
    name: quote.name,
    symbol: quote.symbol,
    exchange: quote.exchange,
    ltp: quote.ltp,
    open: quote.open,
    high: quote.high,
    low: quote.low,
    previousClose: quote.previousClose,
    volume: quote.volume,
    marketCap: 900000000000,
    casScore: 82,
  };

  assert.equal(detail.volume, 4567890);
  assert.ok(detail.marketCap > 0);
  assert.ok(detail.casScore >= 0 && detail.casScore <= 100);
  assert.ok(Object.prototype.hasOwnProperty.call(detail, 'marketCap'));
  assert.ok(Object.prototype.hasOwnProperty.call(detail, 'casScore'));
});
