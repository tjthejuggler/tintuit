#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Create log file with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(logsDir, `api-${timestamp}.log`);

// Create write stream
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Intercept console output
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.debug,
};

// Helper to format messages
const formatMessage = (level, message, ...args) => {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] [${level}] ${message}`;
  
  if (args.length > 0) {
    args.forEach(arg => {
      if (typeof arg === 'object') {
        try {
          logMessage += '\n' + JSON.stringify(arg, null, 2);
        } catch (error) {
          logMessage += '\n[Error stringifying object]';
        }
      } else {
        logMessage += ' ' + String(arg);
      }
    });
  }
  
  return logMessage + '\n';
};

// Override console methods
console.log = (...args) => {
  const message = formatMessage('INFO', ...args);
  logStream.write(message);
  originalConsole.log(...args);
};

console.error = (...args) => {
  const message = formatMessage('ERROR', ...args);
  logStream.write(message);
  originalConsole.error(...args);
};

console.warn = (...args) => {
  const message = formatMessage('WARN', ...args);
  logStream.write(message);
  originalConsole.warn(...args);
};

console.debug = (...args) => {
  const message = formatMessage('DEBUG', ...args);
  logStream.write(message);
  originalConsole.debug(...args);
};

// Handle process exit
process.on('exit', () => {
  logStream.end();
});

process.on('SIGINT', () => {
  logStream.end();
  process.exit();
});

console.log('API logging started');
console.log(`Logs will be written to: ${logFile}`);
