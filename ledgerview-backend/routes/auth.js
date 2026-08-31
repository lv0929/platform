const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Watchlist = require('../models/Watchlist');

const router = express.Router();

const DEFAULT_WATCHLISTS = {
  'My Stocks': [],
  'Swing Trades': [],
  Intraday: [],
  'F&O': [],
  ETFs: [],
};

const accessSecret = process.env.JWT_SECRET || 'dev-secret-change-me';
const refreshSecret = process.env.JWT_REFRESH_SECRET || accessSecret;

function makeTokens(user) {
  const token = jwt.sign({ sub: user._id.toString() }, accessSecret, { expiresIn: '30d' });
  const refreshToken = jwt.sign({ sub: user._id.toString(), type: 'refresh' }, refreshSecret, { expiresIn: '90d' });
  return { token, refreshToken };
}

function genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST /api/auth/send-otp   { phone: "+919876543210" }
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\+\d{6,15}$/.test(phone)) {
    return res.status(400).json({ error: 'Provide phone as "+<countrycode><number>"' });
  }
  const otp = genOtp();
  const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await User.findOneAndUpdate(
    { phone },
    { $set: { otp, otpExpiresAt } },
    { upsert: true, setDefaultsOnInsert: true }
  );

  // --- Real SMS delivery goes here ---
  // e.g. Twilio, MSG91, or any SMS gateway. Wire it in below and remove
  // the console.log. Without it, this is a functional OTP *system*
  // (generated, stored, expiring, verified) but not actually delivered
  // by SMS — that requires your own SMS provider account and API key.
  console.log(`[auth] OTP for ${phone}: ${otp} (valid 5 min)`);

  res.json({ ok: true, message: 'OTP generated (see server logs — wire up a real SMS provider for production).' });
});

// POST /api/auth/verify-otp   { phone, otp, name? }
router.post('/verify-otp', async (req, res) => {
  const { phone, otp, name } = req.body;
  const user = await User.findOne({ phone });
  if (!user || !user.otp || !user.otpExpiresAt) {
    return res.status(400).json({ error: 'No OTP pending for this number' });
  }
  if (user.otpExpiresAt < new Date()) {
    return res.status(400).json({ error: 'OTP expired, request a new one' });
  }
  if (user.otp !== otp) {
    return res.status(400).json({ error: 'Incorrect OTP' });
  }

  const isNewUser = !user.name;
  if (isNewUser) {
    if (!name) return res.status(400).json({ error: 'name is required for a new account', newUser: true });
    user.name = name;
  }
  user.otp = null;
  user.otpExpiresAt = null;
  await user.save();

  if (isNewUser) {
    await Promise.all(
      Object.entries(DEFAULT_WATCHLISTS).map(([wname, items]) =>
        Watchlist.findOneAndUpdate(
          { userId: user._id, name: wname },
          { $setOnInsert: { items } },
          { upsert: true }
        )
      )
    );
  }

  const { token, refreshToken } = makeTokens(user);
  res.json({
    token,
    refreshToken,
    user: { id: user._id, name: user.name, phone: user.phone, pro: user.pro, connectedBroker: user.connectedBroker },
  });
});

// POST /api/auth/refresh { refreshToken }
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });

  try {
    const payload = jwt.verify(refreshToken, refreshSecret);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const tokens = makeTokens(user);
    return res.json(tokens);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

module.exports = router;
