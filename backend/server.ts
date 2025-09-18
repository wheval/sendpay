// Load environment variables FIRST, before any other imports
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import express from "express";
import { spawn } from "child_process";

// NOTE: We no longer import Apibara programmatic APIs here because
// apibara v2 does not export 'apibara/indexer' for direct import.
// Instead, we run the CLI as a child process alongside this HTTP server.

// Start a fake HTTP server so Render doesn't kill the service
const app = express();
const port = process.env.PORT_INDEXER || 3002; // Use different port from API

// Middleware
app.use(express.json());

// Health check endpoint for uptime monitoring
app.get("/health", (_, res) => {
  res.json({
    status: "OK",
    service: "SendPay Indexer",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    indexer: "running"
  });
});

// Root endpoint
app.get("/", (_, res) => {
  res.json({ 
    status: "SendPay Indexer Running", 
    timestamp: new Date().toISOString(),
    health: "/health"
  });
});

// Keep-alive endpoint to prevent Render from sleeping
app.get("/ping", (_, res) => {
  res.json({ pong: Date.now() });
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 SendPay Indexer Server running on port ${port}`);
  console.log(`🔗 Health check: http://localhost:${port}/health`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Start the indexer via CLI in a child process
function startIndexerCli() {
  const npxBin = process.platform === "win32" ? "npx" : "npx";
  const args = ["apibara", "start", "--dir", ".", "--indexer", "sendpay"]; 

  if (process.env.APIBARA_PRESET) {
    args.push("--preset", process.env.APIBARA_PRESET);
  }

  const command = `${npxBin} ${args.join(" ")}`;
  console.log("Starting Apibara indexer via spawn:", command);

  const child = spawn(command, [], { shell: true, stdio: "inherit" });

  child.on("exit", (code) => {
    console.error(`Apibara indexer exited with code ${code}`);
  });
  child.on("error", (err) => {
    console.error("Failed to start Apibara indexer:", err);
  });
}

// Start the indexer CLI alongside the HTTP server
startIndexerCli();
