#!/usr/bin/env node

// ===================================================================
// |> Binary OS Simulator - Hyper-Realistic OS Boot Simulation <|
// ===================================================================
// Purpose:
//   Simulate an operating system boot process with binary operations for educational purposes
// Features:
//   1. Detailed step-by-step OS boot simulation with progress tracking
//   2. Interactive binary input and logical operation selection (AND, OR, XOR, NOT, NAND, NOR, XNOR)
//   3. Robust error handling with safe execution wrapper and detailed stack traces
//   4. ANSI color-coded terminal output for visual clarity
//   5. Adaptive delays to mimic real-time system processes (configurable via --speed flag)
//   6. Centralized logging system with timestamped file output and detailed error reporting
//   7. Graceful shutdown handling via SIGINT
//   8. Resource cleanup for memory management
//   9. Decimal equivalents for binary inputs, operations, and results for enhanced understanding

const fs = require('fs').promises;
const readline = require('readline');
const { resolve } = require('path');

// Configuration constants
const CONFIG = {
  LOG_FILE: resolve(__dirname, '..', `system_${new Date().toISOString().split('T')[0]}.log`),
  DELAY_BASE_MS: 200, // Default delay base in milliseconds
  PROGRESS_BAR_LENGTH: 45,
  MAX_BINARY_LENGTH: 8 // Maximum allowed binary length
};

// Parse command-line arguments for configurable delay
const args = process.argv.slice(2);
const speedFlag = args.find(arg => arg.startsWith('--speed='));
const DELAY_MULTIPLIER = speedFlag ? parseFloat(speedFlag.split('=')[1]) || 1 : 1;

// ========================
// |> Utility Functions <|
// ========================

// ANSI color codes for terminal output
const COLORS = {
  green: '\x1b[92m',
  yellow: '\x1b[93m',
  red: '\x1b[91m',
  blue: '\x1b[94m',
  cyan: '\x1b[96m',
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
 * @returns {string} - Formatted timestamp (e.g., "Mar 24, 2025, 14:30:45")
 */
const getFriendlyTimestamp = () => {
  const date = new Date();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  const time = date.toLocaleString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit', 
    hour12: false 
  });
  return `${month} ${day} ${year}, ${time}`;
};

/**
 * Simulate processing time with adaptive, configurable delay
 * @param {number} [baseMs=CONFIG.DELAY_BASE_MS] - Base delay in milliseconds
 * @returns {Promise<void>}
 */
const adaptiveDelay = async (baseMs = CONFIG.DELAY_BASE_MS) => {
  const adjustedMs = baseMs * DELAY_MULTIPLIER;
  const delayMs = Math.random() * adjustedMs + 100;
  await new Promise(resolve => setTimeout(resolve, delayMs));
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
    if (err.code === 'ENOENT' && context.includes('checking')) return false;
    if (err.code === 'EACCES') {
      await logger.logError(`Access denied: ${err.message}`, 'ACC001', err.stack);
    } else {
      await logger.logError(`Error in ${context}: ${err.message}`, errorCode, err.stack);
    }
    printError(`System failure (${context}): ${err.message}. See logs.`, 'red');
    return null;
  }
};

// ========================
// |> Logger Class <|
// ========================

/**
 * Manages logging operations with file output and detailed error reporting
 */
class Logger {
  constructor(logFile) {
    this.logFile = logFile;
  }

  /**
   * Log an operation to file with timestamp and level
   * @param {string} message - The message to log
   * @param {string} [level='info'] - Log level (info, error, etc.)
   * @param {string} [errorCode=null] - Optional error code
   * @returns {Promise<void>}
   */
  async logOperation(message, level = 'info', errorCode = null) {
    const timestamp = getFriendlyTimestamp();
    const errorSuffix = errorCode ? ` [Code: ${errorCode}]` : '';
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}${errorSuffix}`;
    await safeExecute(async () => {
      try {
        await fs.appendFile(this.logFile, logMessage + '\n');
      } catch (err) {
        if (err.code === 'ENOENT') {
          await fs.writeFile(this.logFile, logMessage + '\n');
        } else {
          throw err;
        }
      }
    }, 'logging operation', 'LOG001', this);
  }

  /**
   * Log and display an error with stack trace
   * @param {string} message - Error message
   * @param {string} errorCode - Error code
   * @param {string} stack - Stack trace
   * @returns {Promise<void>}
   */
  async logError(message, errorCode, stack) {
    await this.logOperation(`${message}\nStack: ${stack}`, 'error', errorCode);
  }

  /**
   * Log and display a step message with delay
   * @param {string} message - The message to log and display
   * @param {string} color - The ANSI color code key
   * @param {number} [delayMs=CONFIG.DELAY_BASE_MS] - Delay in milliseconds
   * @returns {Promise<void>}
   */
  async logStep(message, color, delayMs = CONFIG.DELAY_BASE_MS) {
    print(message, color);
    await this.logOperation(message, 'info');
    await adaptiveDelay(delayMs);
  }

  /**
   * Clear the log file
   * @returns {Promise<void>}
   */
  async clearLogFile() {
    try {
      await fs.writeFile(this.logFile, '');
    } catch (err) {
      await this.logOperation(`Failed to clear log file: ${err.message}`, 'error');
    }
  }

  /**
   * Check and clear log file if previous run failed
   * @returns {Promise<void>}
   */
  async checkAndClearLogFile() {
    try {
      const content = await fs.readFile(this.logFile, 'utf8');
      const lines = content.split('\n');
      const lastLine = lines.length > 0 ? lines[lines.length - 1].trim() : '';
      if (!lastLine.includes('SUCCESS')) {
        await this.clearLogFile();
        await this.logOperation('Log file cleared due to previous failure', 'info');
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        await this.logError(`Error checking log file: ${err.message}`, 'LOG002', err.stack);
      }
      // If file doesn't exist, do nothing
    }
  }
}

// ========================
// |> InputHandler Class <|
// ========================

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
   * @returns {Promise<string>} - Validated binary string (e.g., "1011")
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
        return trimmedInput; // Return original input without padding here
      }
      print(`Invalid input. Use only 0s and 1s, max ${CONFIG.MAX_BINARY_LENGTH} bits.`, 'red');
    }
  }

  /**
   * Prompt user to select a logical operation
   * @returns {Promise<string>} - Selected operation (e.g., "AND")
   */
  async chooseOperation() {
    const operations = ['AND', 'OR', 'XOR', 'NOT', 'NAND', 'NOR', 'XNOR'];
    print('Available logical operations:', 'yellow');
    print('- AND: 1 if both inputs are 1', 'yellow');
    print('- OR: 1 if at least one input is 1', 'yellow');
    print('- XOR: 1 if inputs are different', 'yellow');
    print('- NOT: Inverts first input (unary)', 'yellow');
    print('- NAND: Opposite of AND', 'yellow');
    print('- NOR: Opposite of OR', 'yellow');
    print('- XNOR: 1 if inputs are the same', 'yellow');
    while (true) {
      const operation = (await this.askQuestion('Select operation: ')).toUpperCase().trim();
      if (operations.includes(operation)) {
        return operation;
      }
      print(`Invalid choice. Options: ${operations.join(', ')}`, 'red');
    }
  }

  /**
   * Close the readline interface
   */
  close() {
    this.rl.close();
  }
}

// ========================
// |> Processor Class <|
// ========================

/**
 * Performs logical operations on binary inputs
 */
class Processor {
  /**
   * Compute logical operation result for binary bits
   * @param {string} bit1 - First bit (0 or 1)
   * @param {string} bit2 - Second bit (0 or 1)
   * @param {string} operation - Logical operation (AND, OR, etc.)
   * @returns {string} - Result bit (0 or 1)
   */
  computeBitOperation(bit1, bit2, operation) {
    if (operation === 'AND') return (bit1 === '1' && bit2 === '1') ? '1' : '0';
    if (operation === 'OR') return (bit1 === '1' || bit2 === '1') ? '1' : '0';
    if (operation === 'XOR') return (bit1 !== bit2) ? '1' : '0';
    if (operation === 'NAND') return (bit1 === '1' && bit2 === '1') ? '0' : '1';
    if (operation === 'NOR') return (bit1 === '0' && bit2 === '0') ? '1' : '0';
    if (operation === 'XNOR') return (bit1 === bit2) ? '1' : '0';
    return '0'; // Default fallback for unsupported operations
  }

  /**
   * Perform the selected logical operation on binary inputs with table output
   * @param {string} binary1 - First binary input (padded to 8 bits)
   * @param {string} binary2 - Second binary input (padded to 8 bits)
   * @param {string} operation - Logical operation to perform
   * @param {Logger} logger - Logger instance for logging
   * @returns {Promise<string>} - Result of the operation (8-bit binary)
   */
  async performOperation(binary1, binary2, operation, logger) {
    await logger.logStep('Activating system services...', 'magenta');
    await logger.logStep('Configuring network stack...', 'magenta');
    await logger.logStep(`Executing ${operation} via CPU...`, 'magenta');
    const maxLen = Math.max(binary1.length, binary2.length);
    binary1 = binary1.padStart(maxLen, '0');
    binary2 = binary2.padStart(maxLen, '0');
    let result = '';
    let tableOutput = [];

    const decimal1 = parseInt(binary1, 2);
    const decimal2 = parseInt(binary2, 2);
    print(`  Input A: ${binary1} (decimal: ${decimal1})`, 'cyan');
    if (operation !== 'NOT') print(`  Input B: ${binary2} (decimal: ${decimal2})`, 'cyan');
    print(`Operation: ${operation}`, 'magenta');
    print(`Formula: Result = ${operation === 'NOT' ? 'NOT A' : `A ${operation} B`}`, 'magenta');
    print(` Bit |  A |${operation === 'NOT' ? '' : '  B |'} Result | Explanation`, 'magenta');
    print(`-----|----|${operation === 'NOT' ? '' : '----|'}--------|-------------`, 'magenta');

    if (operation === 'NOT') {
      result = binary1.split('').map(bit => (bit === '0' ? '1' : '0')).join('');
      for (let i = 0; i < maxLen; i++) {
        const bitA = binary1[i];
        const resBit = result[i];
        const explanation = `${bitA} NOT = ${resBit}`;
        tableOutput.push(`  ${i.toString().padEnd(2)} | ${bitA.padStart(2)} | ${resBit.padStart(3).padEnd(6)} | ${explanation}`);
      }
    } else {
      for (let i = 0; i < maxLen; i++) {
        const bit1 = binary1[i];
        const bit2 = binary2[i];
        const resBit = this.computeBitOperation(bit1, bit2, operation);
        const explanation = `${bit1} ${operation} ${bit2} = ${resBit}`;
        result += resBit;
        tableOutput.push(`  ${i.toString().padEnd(2)} | ${bit1.padStart(2)} | ${bit2.padStart(2)} | ${resBit.padStart(3).padEnd(6)} | ${explanation}`);
      }
    }

    tableOutput.forEach(line => print(line, 'magenta'));
    const decimalResult = parseInt(result, 2);
    print(`Result: ${result} (decimal: ${decimalResult})`, 'green');
    await logger.logOperation(`Operation ${operation} executed. Inputs: ${binary1} (decimal: ${decimal1}), ${binary2} (decimal: ${decimal2}). Result: ${result} (decimal: ${decimalResult})`, 'info');
    return result;
  }
}

// ========================
// |> StorageManager Class <|
// ========================

/**
 * Manages storage-related operations like file cleanup
 */
class StorageManager {
  constructor(logger) {
    this.logger = logger;
  }

  /**
   * Clean up old files from storage
   * @param {string[]} files - Array of file paths to check and delete
   * @returns {Promise<void>}
   */
  async clearOldFiles(files) {
    printSeparator('50%: Storage Preparation');
    await this.logger.logStep('Scanning filesystem for stale data...', 'blue');
    const filesToCheck = files.map(file => file === 'log.txt' ? this.logger.logFile : file);
    for (const file of filesToCheck) {
      const exists = await safeExecute(() => fs.stat(file), `checking ${file}`, 'FS001', this.logger);
      if (exists) {
        await safeExecute(() => fs.unlink(file), `deleting ${file}`, 'FS002', this.logger);
        await this.logger.logOperation(`Cleared stale file: ${file}`, 'info');
      }
    }
    await this.logger.logStep('Storage optimized!', 'blue');
    setProgress(50);
  }
}

// ========================
// |> OSSimulator Class <|
// ========================

/**
 * Orchestrates the OS boot simulation process
 */
class OSSimulator {
  constructor() {
    this.logger = new Logger(CONFIG.LOG_FILE);
    this.inputHandler = new InputHandler();
    this.processor = new Processor();
    this.storageManager = new StorageManager(this.logger);
  }

  /** Simulate power-on and BIOS/UEFI initialization */
  async powerOnAndBiosInit() {
    printSeparator('0%: Firmware Initialization');
    await this.logger.logStep('Powering on: Distributing voltage to components...', 'blue');
    await this.logger.logStep('Starting BIOS/UEFI...', 'blue');
    await this.logger.logStep('Running POST: Checking CPU, RAM, GPU, I/O devices...', 'blue');
    await this.logger.logStep('Configuring system clock and parameters...', 'blue');
    await this.logger.logStep('Enabling Secure Boot verification...', 'blue');
    await this.logger.logStep('Firmware ready!', 'blue');
    await this.logger.logOperation('BIOS/UEFI initialization completed with Secure Boot', 'info');
    setProgress(0);
  }

  /** Load bootloader into memory */
  async loadBootloader() {
    printSeparator('10%: Bootloader Stage');
    await this.logger.logStep('Scanning for boot device (HDD/SSD/USB)...', 'blue');
    await this.logger.logStep('Reading MBR/GPT partition table...', 'blue');
    await this.logger.logStep('Loading GRUB into RAM (446 bytes)...', 'blue');
    await this.logger.logStep('Validating EFI System Partition (ESP)...', 'blue');
    await this.logger.logStep('Bootloader initialized!', 'blue');
    await this.logger.logOperation('Bootloader (GRUB) loaded with GPT support', 'info');
    setProgress(10);
  }

  /** Load kernel into Ring 0 */
  async enterRing0AndLoadKernel() {
    printSeparator('20%: Kernel Loading');
    await this.logger.logStep('Transferring kernel to RAM...', 'green');
    await this.logger.logStep('Configuring CPU registers (EAX, EBX, FLAGS)...', 'green');
    await this.logger.logStep('Setting up interrupt descriptor table (IDT)...', 'green');
    await this.logger.logStep('Kernel entered Ring 0!', 'green');
    await this.logger.logOperation('Kernel loaded into Ring 0 with IDT', 'info');
    setProgress(20);
  }

  /** Load kernel modules */
  async loadKernelModules() {
    printSeparator('30%: Kernel Modules');
    await this.logger.logStep('Initializing kernel module loader...', 'green');
    await this.logger.logStep('Linking device drivers (GPU, USB, Network)...', 'green');
    await this.logger.logStep('Dynamically loading filesystem support (ext4/NTFS)...', 'green');
    await this.logger.logStep('Modules linked successfully!', 'green');
    await this.logger.logOperation('Kernel modules loaded and linked', 'info');
    setProgress(30);
  }

  /** Initialize operating system */
  async initializeOS() {
    printSeparator('40%: OS Initialization');
    await this.logger.logStep('Mounting root filesystem...', 'green');
    await this.logger.logStep('Initializing process scheduler (Round-Robin)...', 'green');
    await this.logger.logStep('Forking init process (PID 1)...', 'green');
    await this.logger.logStep('OS ready for user-space!', 'green');
    await this.logger.logOperation('OS initialized with scheduler and init process', 'info');
    setProgress(40);
  }

  /** Collect binary inputs from user */
  async getInput() {
    printSeparator('60%: User Space Activation');
    await this.logger.logStep('Launching user-space interface...', 'blue');
    print('Awaiting user input:', 'blue');
    const originalBinary1 = await this.inputHandler.getBinaryInput("First binary (e.g., 101, max 8 bits): ");
    const originalBinary2 = await this.inputHandler.getBinaryInput("Second binary (e.g., 110, max 8 bits): ");
    const binary1 = originalBinary1.padStart(CONFIG.MAX_BINARY_LENGTH, '0'); // Full 8-bit version
    const binary2 = originalBinary2.padStart(CONFIG.MAX_BINARY_LENGTH, '0'); // Full 8-bit version
    const decimal1 = parseInt(binary1, 2);
    const decimal2 = parseInt(binary2, 2);
    const originalDecimal1 = parseInt(originalBinary1, 2);
    const originalDecimal2 = parseInt(originalBinary2, 2);
    print(`Inputs registered: ${binary1} (decimal: ${decimal1}), ${binary2} (decimal: ${decimal2})`, 'blue');
    await this.logger.logOperation(`User inputs: ${originalBinary1} (decimal: ${originalDecimal1}), ${originalBinary2} (decimal: ${originalDecimal2})`, 'info');
    setProgress(60);
    return [binary1, binary2, originalBinary1, originalBinary2];
  }

  /** Select operation to perform */
  async chooseOperationStage() {
    printSeparator('70%: Operation Selection');
    const operation = await this.inputHandler.chooseOperation();
    print(`Operation selected: ${operation}`, 'yellow');
    await this.logger.logOperation(`Operation chosen: ${operation}`, 'info');
    setProgress(70);
    return operation;
  }

  /** Perform the selected operation */
  async performOperation(binary1, binary2, operation) {
    printSeparator('80%: CPU Execution');
    const result = await this.processor.performOperation(binary1, binary2, operation, this.logger);
    setProgress(80);
    return result;
  }

  /** Store result in simulated RAM */
  async storeInRAM(result) {
    printSeparator('90%: RAM Storage');
    await this.logger.logStep('Allocating RAM for result...', 'green');
    const decimalResult = parseInt(result, 2);
    await this.logger.logStep(`Stored in RAM: ${result} (decimal: ${decimalResult})`, 'green');
    await this.logger.logOperation(`Result stored in RAM: ${result} (decimal: ${decimalResult})`, 'info');
    setProgress(90);
  }

  /** Display final output */
  async displayOutput(operation, originalBinary1, originalBinary2, result) {
    printSeparator('100%: System Ready');
    const decimal1 = parseInt(originalBinary1, 2);
    const decimal2 = parseInt(originalBinary2, 2);
    const decimalResult = parseInt(result, 2);
    print(`Operation: ${operation}`, 'yellow');
    print(`Original Input A: ${originalBinary1} (decimal: ${decimal1}) (Full: ${originalBinary1.padStart(CONFIG.MAX_BINARY_LENGTH, '0')})`, 'yellow');
    if (operation !== 'NOT') print(`Original Input B: ${originalBinary2} (decimal: ${decimal2}) (Full: ${originalBinary2.padStart(CONFIG.MAX_BINARY_LENGTH, '0')})`, 'yellow');
    const trimmedResult = result.replace(/^0+/, '') || '0'; // Remove leading zeros for display
    print(`Result: ${trimmedResult} (decimal: ${decimalResult}) (Full: ${result})`, 'yellow');
    print('System fully operational!', 'green');
    await this.logger.logOperation(`System fully booted. Operation: ${operation}, Inputs: ${originalBinary1} (decimal: ${decimal1}), ${originalBinary2} (decimal: ${decimal2}), Result: ${trimmedResult} (decimal: ${decimalResult})`, 'info');
    setProgress(100);
  }

  /** Optional memory management stage */
  async memoryManagement() {
    printSeparator('Optional: Memory Management');
    await this.logger.logStep('Initializing virtual memory...', 'blue');
    await this.logger.logStep('Setting up paging tables...', 'blue');
    await this.logger.logStep('Memory allocation optimized!', 'blue');
    await this.logger.logOperation('Memory management initialized', 'info');
  }

  /** Optional security enforcement stage */
  async enforceSecurity() {
    printSeparator('Optional: Security Enforcement');
    await this.logger.logStep('Activating SELinux policies...', 'blue');
    await this.logger.logStep('Configuring process capabilities...', 'blue');
    await this.logger.logStep('Security enforced!', 'blue');
    await this.logger.logOperation('Security policies enforced', 'info');
  }

  /** Cleanup resources */
  async cleanup() {
    await this.logger.logOperation('Cleaning up resources...', 'info');
    this.inputHandler.close();
  }

  /** Main simulation execution */
  async run() {
    await this.logger.checkAndClearLogFile(); // Check and clear log file if necessary

    print('Initializing Hyper-Realistic OS Simulation...', 'green');
    await adaptiveDelay();

    await this.powerOnAndBiosInit();          // 0%: Firmware initialization
    await this.loadBootloader();              // 10%: Bootloader loading
    await this.enterRing0AndLoadKernel();     // 20%: Kernel loading into Ring 0
    await this.loadKernelModules();           // 30%: Kernel module initialization
    await this.initializeOS();                // 40%: OS initialization
    await this.storageManager.clearOldFiles(['output.txt']); // 50%: Storage preparation, exclude log file
    const [binary1, binary2, originalBinary1, originalBinary2] = await this.getInput(); // 60%: User input collection
    const operation = await this.chooseOperationStage(); // 70%: Operation selection
    const result = await this.performOperation(binary1, binary2, operation); // 80%: Operation execution
    await this.storeInRAM(result);               // 90%: Result storage in RAM
    await this.displayOutput(operation, originalBinary1, originalBinary2, result); // 100%: Final output display

    // Run optional stages in parallel for performance
    await Promise.all([this.memoryManagement(), this.enforceSecurity()]);

    print('Simulation Complete - System Online!', 'green');
    await this.cleanup();
    await this.logger.logOperation('SUCCESS', 'info'); // Mark successful completion
  }
}

// ========================
// |> Main Execution <|
// ========================

let simulator;

const main = async () => {
  simulator = new OSSimulator();
  await simulator.run();
};

process.on('SIGINT', async () => {
  if (simulator) {
    await simulator.logger.logOperation('System interrupted by user (SIGINT)', 'error');
    print('Shutting down gracefully...', 'yellow');
    await simulator.cleanup();
  }
  process.exit(0);
});

main().catch(async (err) => {
  if (simulator) {
    await simulator.logger.logError(`Critical system failure: ${err.message}`, 'MAIN001', err.stack);
  }
  printError(`Fatal error: ${err.message}. Check logs.`, 'red');
  if (simulator) {
    await simulator.cleanup();
  }
});