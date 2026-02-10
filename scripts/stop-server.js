#!/usr/bin/env node
/**
 * Stop the running server gracefully
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PID_FILE = path.join(__dirname, '..', '.server.pid');

if (!fs.existsSync(PID_FILE)) {
  console.log('No server PID file found. Server may not be running.');
  process.exit(0);
}

const pid = fs.readFileSync(PID_FILE, 'utf-8').trim();
console.log(`Stopping server (PID: ${pid})...`);

const isWindows = process.platform === 'win32';

try {
  if (isWindows) {
    // Windows: Kill entire process tree with /T flag
    try {
      execSync(`taskkill /T /PID ${pid}`, { stdio: 'ignore', timeout: 5000 });
      console.log('Server stopped gracefully');
    } catch (err) {
      // If graceful fails, force kill the tree
      console.log('Graceful stop failed, forcing...');
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore', timeout: 5000 });
      console.log('Server force stopped');
    }
  } else {
    // Unix: Use kill with process group
    try {
      execSync(`kill ${pid}`, { stdio: 'ignore' });
      console.log('Server stopped gracefully');
    } catch (err) {
      console.log('Graceful stop failed, forcing...');
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
      console.log('Server force stopped');
    }
  }
} catch (err) {
  console.error('Failed to stop server:', err.message);
  console.log('\nTrying to clean up any remaining processes on port 3000...');

  if (isWindows) {
    try {
      // Find and kill process on port 3000
      const netstat = execSync('netstat -ano | findstr ":3000.*LISTENING"', { encoding: 'utf-8' });
      const matches = netstat.match(/\s+(\d+)\s*$/m);
      if (matches && matches[1]) {
        execSync(`taskkill /F /T /PID ${matches[1]}`, { stdio: 'ignore' });
        console.log('Cleaned up process on port 3000');
      }
    } catch (e) {
      console.error('Could not clean up port 3000');
    }
  }

  process.exit(1);
}

// Wait a moment for processes to actually terminate
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  await sleep(1000);

  // Verify process is actually gone
  if (isWindows) {
    try {
      execSync(`tasklist /FI "PID eq ${pid}" | find "${pid}"`, { stdio: 'ignore' });
      console.warn('⚠ Warning: Process may still be running');
    } catch (e) {
      // Process not found - this is good!
    }
  }

  // Clean up PID file
  try {
    fs.unlinkSync(PID_FILE);
  } catch (err) {
    // Ignore
  }

  console.log('✓ Server stopped successfully');
  console.log('\nYou can now restart the server with start.bat');
})();
