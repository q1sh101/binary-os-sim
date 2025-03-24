#!/usr/bin/env node

// ===================================================================
// |> Binary OS Simulator - Hyper-Realistic OS Boot Simulation <|
// ===================================================================
// Purpose:
//   Simulate an operating system boot process with binary operations for educational purposes

const fs = require('fs').promises;
const readline = require('readline');
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
 * Generate a human-readable timestamp
 * @returns {string} - Formatted timestamp
 */
const getFriendlyTimestamp = () => {
  const date = new Date();
  return date.toISOString();
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
   * Log an operation to file with timestamp and level
   * @param {string} message - The message to log
   * @param {string} [level='info'] - Log level
   * @returns {Promise<void>}
   */
  async logOperation(message, level = 'info') {
    const timestamp = getFriendlyTimestamp();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    await safeExecute(async () => fs.appendFile(this.logFile, logMessage + '\n'), 'logging', 'LOG001', this);
  }

  /**
   * Log an error with message and code
   * @param {string} message - Error message
   * @param {string} errorCode - Error code
   */
  async logError(message, errorCode) {
    await this.logOperation(`${message} [Code: ${errorCode}]`, 'error');
  }

  /**
   * Log and display a step message with delay
   * @param {string} message - The message to log and display
   * @param {string} color - The ANSI color code key
   * @returns {Promise<void>}
   */
  async logStep(message, color) {
    print(message, color);
    await this.logOperation(message);
    await adaptiveDelay();
  }
}

/**
 * Handles user input collection and validation
 */
class InputHandler {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  /**
   * Ask a question and return user response
   * @param {string} query - The question to ask
   * @returns {Promise<string>} - User's response
   */
  async askQuestion(query) {
    return new Promise(resolve => this.rl.question(`${COLORS.cyan}${query}${COLORS.reset}`, resolve));
  }

  /**
   * Get validated binary input from user
   * @param {string} prompt - The prompt to display
   * @returns {Promise<string>} - Validated binary string
   */
  async getBinaryInput(prompt) {
    while (true) {
      const input = await this.askQuestion(prompt);
      const trimmedInput = input.trim();
      if (trimmedInput === '') {
        print('Input cannot be empty. Please try again.', 'red');
        continue;
      }
      if (/^[01]{1,8}$/.test(trimmedInput)) {
        return trimmedInput;
      }
      print(`Invalid input. Use only 0s and 1s, max ${CONFIG.MAX_BINARY_LENGTH} bits.`, 'red');
    }
  }

  /**
   * Prompt user to select a logical operation
   * @returns {Promise<string>} - Selected operation
   */
  async chooseOperation() {
    const operations = ['AND', 'OR', 'XOR'];
    print('Available logical operations: AND, OR, XOR', 'yellow');
    while (true) {
      const operation = (await this.askQuestion('Select operation: ')).toUpperCase().trim();
      if (operations.includes(operation)) {
        return operation;
      }
      print(`Invalid choice. Options: ${operations.join(', ')}`, 'red');
    }
  }
}

/**
 * Performs logical operations on binary inputs
 */
class Processor {
  /**
   * Compute logical operation result for binary bits
   * @param {string} bit1 - First bit (0 or 1)
   * @param {string} bit2 - Second bit (0 or 1)
   * @param {string} operation - Logical operation
   * @returns {string} - Result bit (0 or 1)
   */
  computeBitOperation(bit1, bit2, operation) {
    if (operation === 'AND') return (bit1 === '1' && bit2 === '1') ? '1' : '0';
    if (operation === 'OR') return (bit1 === '1' || bit2 === '1') ? '1' : '0';
    if (operation === 'XOR') return (bit1 !== bit2) ? '1' : '0';
    return '0';
  }

  /**
   * Perform the selected logical operation on binary inputs
   * @param {string} binary1 - First binary input
   * @param {string} binary2 - Second binary input
   * @param {string} operation - Logical operation
   * @param {Logger} logger - Logger instance
   * @returns {Promise<string>} - Result
   */
  async performOperation(binary1, binary2, operation, logger) {
    await logger.logStep(`Executing ${operation} via CPU...`, 'magenta');
    const maxLen = Math.max(binary1.length, binary2.length);
    binary1 = binary1.padStart(maxLen, '0');
    binary2 = binary2.padStart(maxLen, '0');
    let result = '';
    for (let i = 0; i < maxLen; i++) {
      const resBit = this.computeBitOperation(binary1[i], binary2[i], operation);
      result += resBit;
      print(`  Bit ${i} | A=${binary1[i]} B=${binary2[i]} → ${operation}=${resBit}`, 'magenta');
      await adaptiveDelay();
    }
    print(`Result: ${result}`, 'green');
    await logger.logOperation(`Operation ${operation} executed. Result: ${result}`);
    return result;
  }
}

/**
 * Orchestrates the OS boot simulation process
 */
class OSSimulator {
  constructor() {
    this.logger = new Logger(CONFIG.LOG_FILE);
    this.inputHandler = new InputHandler();
    this.processor = new Processor();
  }

  /** Simulate power-on and BIOS/UEFI initialization */
  async powerOnAndBiosInit() {
    printSeparator('0%: Firmware Initialization');
    await this.logger.logStep('Powering on: Distributing voltage to components...', 'blue');
    await this.logger.logStep('Starting BIOS/UEFI...', 'blue');
    await this.logger.logStep('Firmware ready!', 'blue');
    setProgress(0);
  }

  /** Load bootloader into memory */
  async loadBootloader() {
    printSeparator('10%: Bootloader Stage');
    await this.logger.logStep('Scanning for boot device (HDD/SSD/USB)...', 'blue');
    await this.logger.logStep('Loading GRUB into RAM...', 'blue');
    await this.logger.logStep('Bootloader initialized!', 'blue');
    setProgress(10);
  }

  /** Load kernel into Ring 0 */
  async enterRing0AndLoadKernel() {
    printSeparator('20%: Kernel Loading');
    await this.logger.logStep('Transferring kernel to RAM...', 'green');
    await this.logger.logStep('Kernel entered Ring 0!', 'green');
    setProgress(20);
  }

  /** Load kernel modules */
  async loadKernelModules() {
    printSeparator('30%: Kernel Modules');
    await this.logger.logStep('Initializing kernel module loader...', 'green');
    await this.logger.logStep('Modules linked successfully!', 'green');
    setProgress(30);
  }

  /** Collect binary inputs from user */
  async getInput() {
    printSeparator('40%: User Space Activation');
    await this.logger.logStep('Awaiting user input:', 'blue');
    const binary1 = await this.inputHandler.getBinaryInput("First binary (e.g., 101): ");
    const binary2 = await this.inputHandler.getBinaryInput("Second binary (e.g., 110): ");
    print(`Inputs registered: ${binary1}, ${binary2}`, 'blue');
    await this.logger.logOperation(`User inputs: ${binary1} and ${binary2}`);
    setProgress(40);
    return [binary1, binary2];
  }

  /** Select operation to perform */
  async chooseOperationStage() {
    printSeparator('50%: Operation Selection');
    const operation = await this.inputHandler.chooseOperation();
    print(`Operation selected: ${operation}`, 'yellow');
    await this.logger.logOperation(`Operation chosen: ${operation}`);
    setProgress(50);
    return operation;
  }

  /** Perform the selected operation */
  async performOperation(binary1, binary2, operation) {
    printSeparator('60%: CPU Execution');
    const result = await this.processor.performOperation(binary1, binary2, operation, this.logger);
    setProgress(60);
    return result;
  }

  /** Store result in simulated RAM */
  async storeInRAM(result) {
    printSeparator('70%: RAM Storage');
    await this.logger.logStep('Allocating RAM for result...', 'green');
    await this.logger.logStep(`Stored in RAM: ${result}`, 'green');
    setProgress(70);
  }

  /** Main simulation execution */
  async run() {
    print('Initializing Hyper-Realistic OS Simulation...', 'green');
    await adaptiveDelay();
    await this.powerOnAndBiosInit();
    await this.loadBootloader();
    await this.enterRing0AndLoadKernel();
    await this.loadKernelModules();
    const [binary1, binary2] = await this.getInput();
    const operation = await this.chooseOperationStage();
    const result = await this.performOperation(binary1, binary2, operation);
    await this.storeInRAM(result);
  }
}

// Main execution
const main = async () => {
  const simulator = new OSSimulator();
  await simulator.run();
};

main();