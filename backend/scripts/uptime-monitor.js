#!/usr/bin/env node

/**
 * Uptime Monitor for SendPay Indexer
 * Pings the indexer health endpoint every 4 minutes to prevent Render from sleeping
 */

const https = require('https');
const http = require('http');

const INDEXER_URL = process.env.INDEXER_URL || 'http://localhost:3002';
const PING_INTERVAL = 4 * 60 * 1000; // 4 minutes (Render sleeps after 5 minutes of inactivity)

function pingIndexer() {
  const url = new URL(INDEXER_URL);
  const client = url.protocol === 'https:' ? https : http;
  
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: '/ping',
    method: 'GET',
    timeout: 10000
  };

  const req = client.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ✅ Indexer ping successful: ${res.statusCode}`);
    });
  });

  req.on('error', (err) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ Indexer ping failed:`, err.message);
  });

  req.on('timeout', () => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ⏰ Indexer ping timeout`);
    req.destroy();
  });

  req.end();
}

// Start monitoring
console.log(`🔄 Starting uptime monitor for ${INDEXER_URL}`);
console.log(`⏰ Ping interval: ${PING_INTERVAL / 1000} seconds`);

// Ping immediately
pingIndexer();

// Set up interval
setInterval(pingIndexer, PING_INTERVAL);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down uptime monitor...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down uptime monitor...');
  process.exit(0);
});
