const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { normalizeChartSymbol, mapCandleInterval } = require('../services/angelOneService');

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
