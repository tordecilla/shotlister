#!/usr/bin/env node
/**
 * Production-ready server wrapper for Next.js
 * Handles graceful shutdown and proper process cleanup
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PID_FILE = path.join(__dirname, '.server.pid');
const PORT = process.env.PORT || 3000;

// Clean up on exit
function cleanup() {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (err) {
    console.error('Error cleaning up PID file:', err);
  }
}

// Graceful shutdown
function shutdown(signal) {
  console.log(`\n${signal} received, shutting down gracefully...`);
  cleanup();
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('exit', cleanup);

// Check if server is already running
if (fs.existsSync(PID_FILE)) {
  const oldPid = fs.readFileSync(PID_FILE, 'utf-8').trim();
  console.warn(`Warning: Server PID file exists (PID: ${oldPid})`);
  console.warn('If server is not running, delete .server.pid and try again');

  // Try to check if process is actually running (Windows)
  try {
    const { execSync } = require('child_process');
    execSync(`tasklist /FI "PID eq ${oldPid}" 2>nul | find "${oldPid}" >nul`, { stdio: 'ignore' });
    console.error('Server is already running!');
    process.exit(1);
  } catch (err) {
    // Process not found, clean up stale PID file
    console.log('Cleaning up stale PID file...');
    fs.unlinkSync(PID_FILE);
  }
}

// Write our PID
fs.writeFileSync(PID_FILE, process.pid.toString());

console.log(`Starting Next.js server on port ${PORT}...`);
console.log(`Server PID: ${process.pid}`);

// Start Next.js
const isDev = process.argv.includes('--dev') || process.env.NODE_ENV !== 'production';
const nextCommand = isDev ? 'next dev' : 'next start';

const server = spawn(`npx ${nextCommand}`, [], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: PORT.toString() }
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  cleanup();
  process.exit(1);
});

server.on('exit', (code, signal) => {
  console.log(`Server exited with code ${code} and signal ${signal}`);
  cleanup();
  process.exit(code || 0);
});
