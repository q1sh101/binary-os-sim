#!/usr/bin/env node

// ===================================================================
// |> Binary OS Simulator - Hyper-Realistic OS Boot Simulation <|
// ===================================================================
// Purpose:
//   Simulate an operating system boot process with binary operations for educational purposes

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
 * Orchestrates the OS boot simulation process
 */
class OSSimulator {
  constructor() {}

  /** Simulate power-on and BIOS/UEFI initialization */
  async powerOnAndBiosInit() {
    printSeparator('0%: Firmware Initialization');
    print('Powering on: Distributing voltage to components...', 'blue');
    await adaptiveDelay();
    print('Starting BIOS/UEFI...', 'blue');
    await adaptiveDelay();
    print('Firmware ready!', 'blue');
    setProgress(0);
  }

  /** Main simulation execution */
  async run() {
    print('Initializing Hyper-Realistic OS Simulation...', 'green');
    await adaptiveDelay();
    await this.powerOnAndBiosInit();
  }
}

// Main execution
const main = async () => {
  const simulator = new OSSimulator();
  await simulator.run();
};

main();