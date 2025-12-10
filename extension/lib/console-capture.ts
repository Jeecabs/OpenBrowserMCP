/**
 * Console log capture
 *
 * Intercepts and stores console messages for retrieval via the console tool.
 */

import type { ConsoleLog } from "./protocol";

// Maximum number of logs to store
const MAX_LOGS = 1000;

// Store for captured console logs
const capturedLogs: ConsoleLog[] = [];

// Original console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug
};

/**
 * Initialize console capture
 * Call this once when the content script loads
 */
export function initConsoleCapture(): void {
  // Override console methods
  console.log = createInterceptor("log", originalConsole.log);
  console.info = createInterceptor("info", originalConsole.info);
  console.warn = createInterceptor("warn", originalConsole.warn);
  console.error = createInterceptor("error", originalConsole.error);
  console.debug = createInterceptor("debug", originalConsole.debug);
}

/**
 * Create an interceptor function for a console method
 */
function createInterceptor(
  level: ConsoleLog["level"],
  originalMethod: (...args: any[]) => void
) {
  return function(...args: any[]): void {
    // Capture the log
    captureLog(level, args);

    // Call original method
    originalMethod.apply(console, args);
  };
}

/**
 * Capture a console log
 */
function captureLog(level: ConsoleLog["level"], args: any[]): void {
  // Convert args to string
  const text = args.map(arg => {
    if (typeof arg === "string") {
      return arg;
    }
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}\n${arg.stack}`;
    }
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }).join(" ");

  const log: ConsoleLog = {
    level,
    ts: Date.now(),
    text
  };

  capturedLogs.push(log);

  // Keep only the last MAX_LOGS entries
  if (capturedLogs.length > MAX_LOGS) {
    capturedLogs.shift();
  }
}

/**
 * Get all captured console logs
 */
export function getConsoleLogs(): ConsoleLog[] {
  return [...capturedLogs];
}

/**
 * Clear all captured console logs
 */
export function clearConsoleLogs(): void {
  capturedLogs.length = 0;
}

/**
 * Stop console capture and restore original methods
 */
export function stopConsoleCapture(): void {
  console.log = originalConsole.log;
  console.info = originalConsole.info;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.debug = originalConsole.debug;
}
