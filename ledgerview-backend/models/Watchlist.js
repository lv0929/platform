const mongoose = require('mongoose');

const watchlistItemSchema = new mongoose.Schema(
  {
    sym: { type: String, required: true },
    price: { type: String, default: '—' },
    chg: { type: String, default: '0.00%' },
    dir: { type: String, enum: ['up', 'down'], default: 'up' },
    signal: { type: String, default: 'HOLD' },
    target: { type: String, default: null },
  },
  { _id: false }
);

const watchlistSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    items: { type: [watchlistItemSchema], default: [] },
  },
  { timestamps: true }
);

watchlistSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Watchlist', watchlistSchema);
