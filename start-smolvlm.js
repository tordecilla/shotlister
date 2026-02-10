#!/usr/bin/env node
/**
 * Start SmolVLM server in the background
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const SMOLVLM_PID_FILE = path.join(__dirname, '.smolvlm.pid');
const SMOLVLM_PORT = 8765;

// Check if already running
if (fs.existsSync(SMOLVLM_PID_FILE)) {
  const oldPid = fs.readFileSync(SMOLVLM_PID_FILE, 'utf-8').trim();
  console.warn(`SmolVLM server PID file exists (PID: ${oldPid})`);
  console.warn('Checking if server is running...');

  // Check health endpoint
  http.get(`http://localhost:${SMOLVLM_PORT}/health`, (res) => {
    if (res.statusCode === 200) {
      console.log('SmolVLM server is already running!');
      process.exit(0);
    } else {
      console.log('Stale PID file, cleaning up...');
      fs.unlinkSync(SMOLVLM_PID_FILE);
      startServer();
    }
  }).on('error', () => {
    console.log('Stale PID file, cleaning up...');
    try {
      fs.unlinkSync(SMOLVLM_PID_FILE);
    } catch (e) { }
    startServer();
  });
} else {
  startServer();
}

function startServer() {
  console.log('Starting SmolVLM2 server...');
  console.log('This will take 60-90 seconds to load the model...');

  const scriptPath = path.join(__dirname, 'scripts', 'smolvlm_server.py');

  // Create log file for output
  const logPath = path.join(__dirname, '.smolvlm.log');
  const logStream = fs.createWriteStream(logPath, { flags: 'w' });

  const server = spawn('python', [scriptPath, SMOLVLM_PORT.toString()], {
    detached: true,
    stdio: ['ignore', logStream, logStream]
  });

  // Save PID
  fs.writeFileSync(SMOLVLM_PID_FILE, server.pid.toString());

  console.log(`SmolVLM2 server starting (PID: ${server.pid})...`);
  console.log(`Logs: ${logPath}`);
  console.log('Waiting for model to load...\n');

  // Detach immediately
  server.unref();

  // Poll for readiness
  let attempts = 0;
  const maxAttempts = 120; // 2 minutes

  const checkReady = setInterval(() => {
    attempts++;
    http.get(`http://localhost:${SMOLVLM_PORT}/health`, (res) => {
      if (res.statusCode === 200) {
        clearInterval(checkReady);
        console.log('✓ SmolVLM2 server is ready!');
        console.log(`  Listening on http://localhost:${SMOLVLM_PORT}`);
        console.log('  Model loaded and cached in memory\n');
        process.exit(0);
      }
    }).on('error', () => {
      if (attempts >= maxAttempts) {
        clearInterval(checkReady);
        console.error('✗ Timeout waiting for SmolVLM2 server');
        console.error(`  Check logs at: ${logPath}`);
        process.exit(1);
      }
    });
  }, 1000);

  server.on('error', (err) => {
    console.error('Failed to start SmolVLM server:', err);
    try {
      fs.unlinkSync(SMOLVLM_PID_FILE);
    } catch (e) { }
    process.exit(1);
  });

  server.on('exit', (code) => {
    if (!ready) {
      console.error(`SmolVLM server exited with code ${code}`);
      try {
        fs.unlinkSync(SMOLVLM_PID_FILE);
      } catch (e) { }
      process.exit(code || 1);
    }
  });

  // Timeout after 3 minutes
  setTimeout(() => {
    if (!ready) {
      console.error('Timeout waiting for SmolVLM server to start');
      server.kill();
      try {
        fs.unlinkSync(SMOLVLM_PID_FILE);
      } catch (e) { }
      process.exit(1);
    }
  }, 180000);
}
