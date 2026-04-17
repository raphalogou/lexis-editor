/**
 * Simple logger utility with level-based output
 * Enable debug logging by setting: localStorage.setItem('DEBUG', '1')
 * Or in development: set VITE_DEBUG=1 environment variable
 */
export class Logger {
  /**
   * @param {boolean} [debug]
   */
  constructor(debug) {
    this.debugEnabled = debug ?? import.meta.env.VITE_DEBUG === "1";
  }

  /**
   * @param {string} message
   * @param {...any} args
   */
  debug(message, ...args) {
    if (this.debugEnabled) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * @param {string} message
   * @param {...any} args
   */
  info(message, ...args) {
    console.log(`[INFO] ${message}`, ...args);
  }

  /**
   * @param {string} message
   * @param {...any} args
   */
  warn(message, ...args) {
    console.warn(`[WARN] ${message}`, ...args);
  }

  /**
   * @param {string} message
   * @param {...any} args
   */
  error(message, ...args) {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

export const logger = new Logger();
