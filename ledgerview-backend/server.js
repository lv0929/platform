require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const angelOne = require('./services/angelOneService');

const authRoutes = require('./routes/auth');
const watchlistRoutes = require('./routes/watchlists');
const marketRoutes = require('./routes/market');

const app = express();
app.use(express.json());

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
  })
);

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'ledgerview-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/watchlists', watchlistRoutes);
app.use('/api/market', marketRoutes);

app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function startServer(port = process.env.PORT || 4000) {
  await connectDB();

  try {
    await angelOne.loadInstrumentMaster();
  } catch (err) {
    console.warn('[server] Angel One instrument master failed to load:', err.message);
  }

  const hasAngelCreds = ['ANGEL_API_KEY', 'ANGEL_CLIENT_CODE', 'ANGEL_MPIN', 'ANGEL_TOTP_SECRET'].every((key) => !!process.env[key]);
  if (hasAngelCreds) {
    try {
      await angelOne.login();
      console.log('[server] Angel One session authenticated successfully');
    } catch (err) {
      console.warn('[server] Angel One startup auth failed:', err.message);
    }
  } else {
    console.warn('[server] Angel One credentials not configured; live market data will be unavailable until env vars are added.');
  }

  return app.listen(port, () => console.log(`[server] LedgerView backend listening on :${port}`));
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('[server] Failed to start:', err.message);
    process.exit(1);
  });
}

module.exports = { app, startServer };
