const { WebSocketServer, WebSocket } = require('ws');
const angelOne = require('./angelOneService');

const DEFAULT_SYMBOLS = ['RELIANCE', 'HDFCBANK', 'ICICIBANK', 'TCS', 'INFY'];
const POLL_INTERVAL_MS = Number(process.env.LIVE_FEED_INTERVAL_MS || 5000);

function createLiveFeedService(server) {
  const clients = new Map();
  const websocketServer = new WebSocketServer({ noServer: true });
  let timer = null;
  let polling = false;

  async function publish(client, symbol) {
    try {
      const quote = await angelOne.getQuote(symbol);
      const raw = quote.raw || {};
      const payload = {
        type: 'quote',
        symbol: quote.symbol,
        name: quote.name,
        exchange: quote.exchange,
        ltp: quote.ltp,
        volume: quote.volume,
        bid: Number(raw.bid ?? raw.bidPrice ?? raw.bestBidPrice ?? 0) || null,
        ask: Number(raw.ask ?? raw.askPrice ?? raw.bestAskPrice ?? 0) || null,
        timestamp: new Date().toISOString(),
        change: quote.change,
        percentChange: quote.percentChange,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        previousClose: quote.previousClose,
      };
      if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(payload));
    } catch (error) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'error', symbol, error: error.message, timestamp: new Date().toISOString() }));
      }
    }
  }

  async function poll() {
    if (polling || clients.size === 0) return;
    polling = true;
    try {
      await Promise.all([...clients.entries()].flatMap(([client, symbols]) => [...symbols].map((symbol) => publish(client, symbol))));
    } finally {
      polling = false;
    }
  }

  function ensureTimer() {
    if (!timer) timer = setInterval(poll, POLL_INTERVAL_MS);
  }

  function stopTimerIfIdle() {
    if (clients.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  websocketServer.on('connection', (socket, request) => {
    const querySymbols = new URL(request.url || '', 'http://localhost').searchParams.get('symbols');
    const symbols = new Set((querySymbols ? querySymbols.split(',') : DEFAULT_SYMBOLS)
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 25));
    clients.set(socket, symbols);
    socket.send(JSON.stringify({ type: 'ready', symbols: [...symbols], intervalMs: POLL_INTERVAL_MS }));
    ensureTimer();
    poll();

    socket.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'subscribe' && Array.isArray(data.symbols)) {
          clients.set(socket, new Set(data.symbols.map((symbol) => String(symbol).trim().toUpperCase()).filter(Boolean).slice(0, 25)));
          poll();
        }
      } catch (error) {
        socket.send(JSON.stringify({ type: 'error', error: 'Invalid subscription message' }));
      }
    });
    socket.on('close', () => {
      clients.delete(socket);
      stopTimerIfIdle();
    });
    socket.on('error', () => {
      clients.delete(socket);
      stopTimerIfIdle();
    });
  });

  function upgrade(request, socket, head) {
    if (!request.url || !request.url.startsWith('/ws/market')) return false;
    websocketServer.handleUpgrade(request, socket, head, (client) => websocketServer.emit('connection', client, request));
    return true;
  }

  server.on('upgrade', (request, socket, head) => {
    if (!upgrade(request, socket, head)) socket.destroy();
  });

  return {
    server: websocketServer,
    close() {
      if (timer) clearInterval(timer);
      timer = null;
      websocketServer.close();
    },
  };
}

module.exports = { createLiveFeedService, DEFAULT_SYMBOLS, POLL_INTERVAL_MS };
