const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI || (process.env.NODE_ENV !== 'production' ? 'mongodb://127.0.0.1:27017/ledgerview' : null);
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('[db] Connected to MongoDB');

  mongoose.connection.on('error', (err) => {
    console.error('[db] Connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] Disconnected from MongoDB');
  });
}

module.exports = { connectDB };
