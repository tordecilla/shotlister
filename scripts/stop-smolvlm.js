#!/usr/bin/env node
/**
 * Stop the SmolVLM server
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PID_FILE = path.join(__dirname, '..', '.smolvlm.pid');

if (!fs.existsSync(PID_FILE)) {
  console.log('SmolVLM server is not running (no PID file)');
  process.exit(0);
}

const pid = fs.readFileSync(PID_FILE, 'utf-8').trim();
console.log(`Stopping SmolVLM server (PID: ${pid})...`);

const isWindows = process.platform === 'win32';

try {
  if (isWindows) {
    execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore', timeout: 5000 });
  } else {
    execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
  }
  console.log('SmolVLM server stopped');
} catch (err) {
  console.log('Server may not be running');
}

// Clean up PID file
try {
  fs.unlinkSync(PID_FILE);
} catch (e) { }

console.log('✓ SmolVLM server cleanup complete');
