const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // Full international phone number incl. country code, e.g. "+919876543210"
    phone: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    pro: { type: Boolean, default: false },
    connectedBroker: { type: String, default: null },
    proSince: { type: String, default: null },
    // Simulated OTP for this prototype's own login (NOT Angel One's).
    // In production, replace with a real SMS provider (Twilio/MSG91/etc.)
    // and never store the OTP in plaintext for longer than its short TTL.
    otp: { type: String, default: null },
    otpExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
