#!/usr/bin/env node

// ===================================================================
// |> Binary OS Simulator - Hyper-Realistic OS Boot Simulation <|
// ===================================================================
// Purpose:
//   Simulate an operating system boot process with binary operations for educational purposes

const fs = require('fs').promises;
const { resolve } = require('path');

// Configuration constants
const CONFIG = {
  LOG_FILE: resolve(__dirname, '..', `system_${new Date().toISOString().split('T')[0]}.log`),
  DELAY_BASE_MS: 200, // Default delay base in milliseconds
  PROGRESS_BAR_LENGTH: 50,
  MAX_BINARY_LENGTH: 8 // Maximum allowed binary length
};

// Parse command-line arguments for configurable delay
const args = process.argv.slice(2);
const speedFlag = args.find(arg => arg.startsWith('--speed='));
const DELAY_MULTIPLIER = speedFlag ? parseFloat(speedFlag.split('=')[1]) || 1 : 1;

// ANSI color codes for terminal output
const COLORS = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m'
};

/**
 * Print a message to the console with specified color
 * @param {string} message - The message to print
 * @param {string} color - The ANSI color code key
 */
const print = (message, color) => {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
};

/**
 * Print an error message to the console with specified color
 * @param {string} message - The error message to print
 * @param {string} color - The ANSI color code key
 */
const printError = (message, color) => {
  console.error(`${COLORS[color]}${message}${COLORS.reset}`);
};

/**
 * Display a titled separator line
 * @param {string} [title=''] - Title to display in the separator
 * @param {number} [length=CONFIG.PROGRESS_BAR_LENGTH] - Length of the separator
 */
const printSeparator = (title = '', length = CONFIG.PROGRESS_BAR_LENGTH) => {
  const padding = Math.max(0, Math.floor((length - title.length - 4) / 2));
  print(`${'-'.repeat(padding)} ${title} ${'-'.repeat(padding)}`, 'yellow');
};

/**
 * Render a progress bar
 * @param {number} percent - Percentage of progress (0-100)
 */
const setProgress = (percent) => {
  const filled = Math.round(CONFIG.PROGRESS_BAR_LENGTH * (percent / 100));
  print(`[${'█'.repeat(filled)}${'-'.repeat(CONFIG.PROGRESS_BAR_LENGTH - filled)}] ${percent}%`, 'green');
};

/**
 * Simulate processing time with adaptive delay
 * @param {number} [baseMs=CONFIG.DELAY_BASE_MS] - Base delay in milliseconds
 * @returns {Promise<void>}
 */
const adaptiveDelay = async (baseMs = CONFIG.DELAY_BASE_MS) => {
  const adjustedMs = baseMs * DELAY_MULTIPLIER;
  const delayMs = Math.random() * adjustedMs + 100;
  await new Promise(resolve => setTimeout(resolve, delayMs));
};

/**
 * Execute a function safely with error handling
 * @param {Function} fn - The function to execute
 * @param {string} [context=''] - Context description for error reporting
 * @param {string} [errorCode='GEN001'] - Error code for logging
 * @param {Logger} logger - Logger instance for error logging
 * @returns {Promise<any>} - Result of the function or null on error
 */
const safeExecute = async (fn, context = '', errorCode = 'GEN001', logger) => {
  try {
    return await fn();
  } catch (err) {
    await logger.logError(`Error in ${context}: ${err.message}`, errorCode);
    printError(`System failure (${context}): ${err.message}`, 'red');
    return null;
  }
};

/**
 * Manages logging operations with file output
 */
class Logger {
  constructor(logFile) {
    this.logFile = logFile;
  }

  /**
   * Log an operation to file with timestamp
   * @param {string} message - The message to log
   * @returns {Promise<void>}
   */
  async logOperation(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    await safeExecute(async () => fs.appendFile(this.logFile, logMessage + '\n'), 'logging', 'LOG001', this);
  }

  /**
   * Log an error with message and code
   * @param {string} message - Error message
   * @param {string} errorCode - Error code
   */
  async logError(message, errorCode) {
    await this.logOperation(`[ERROR] ${message} [Code: ${errorCode}]`);
  }
}

/**
 * Orchestrates the OS boot simulation process
 */
class OSSimulator {
  constructor() {
    this.logger = new Logger(CONFIG.LOG_FILE);
  }

  /** Simulate power-on and BIOS/UEFI initialization */
  async powerOnAndBiosInit() {
    printSeparator('0%: Firmware Initialization');
    print('Powering on: Distributing voltage to components...', 'blue');
    await adaptiveDelay();
    print('Starting BIOS/UEFI...', 'blue');
    await adaptiveDelay();
    print('Firmware ready!', 'blue');
    await this.logger.logOperation('BIOS initialized');
    setProgress(0);
  }

  /** Load bootloader into memory */
  async loadBootloader() {
    printSeparator('10%: Bootloader Stage');
    print('Scanning for boot device (HDD/SSD/USB)...', 'blue');
    await adaptiveDelay();
    print('Loading GRUB into RAM...', 'blue');
    await adaptiveDelay();
    print('Bootloader initialized!', 'blue');
    await this.logger.logOperation('Bootloader loaded');
    setProgress(10);
  }

  /** Load kernel into Ring 0 */
  async enterRing0AndLoadKernel() {
    printSeparator('20%: Kernel Loading');
    print('Transferring kernel to RAM...', 'green');
    await adaptiveDelay();
    print('Kernel entered Ring 0!', 'green');
    await this.logger.logOperation('Kernel loaded');
    setProgress(20);
  }

  /** Main simulation execution */
  async run() {
    print('Initializing Hyper-Realistic OS Simulation...', 'green');
    await adaptiveDelay();
    await this.powerOnAndBiosInit();
    await this.loadBootloader();
    await this.enterRing0AndLoadKernel();
  }
}

// Main execution
const main = async () => {
  const simulator = new OSSimulator();
  await simulator.run();
};

main();