#!/usr/bin/env node

// ===================================================================
// |> Binary OS Simulator - Hyper-Realistic OS Boot Simulation <|
// ===================================================================
// Purpose:
//   Simulate an operating system boot process with binary operations for educational purposes
// Features:
//   1. Detailed step-by-step OS boot simulation with progress tracking
//   2. Interactive binary input and logical operation selection (AND, OR, XOR, NOT, NAND, NOR, XNOR)
//   3. Enhanced error handling with comprehensive stack traces and error codes
//   4. ANSI color-coded terminal output for visual clarity
//   5. Adaptive delays to mimic real-time system processes (configurable via --speed flag)
//   6. Centralized logging with verbose mode, log levels (INFO, DEBUG, ERROR), and timestamped file output
//   7. Graceful shutdown handling via SIGINT with resource cleanup
//   8. Realistic hardware and software initialization (POST, Secure Boot, kernel parameters)
//   9. Decimal equivalents for binary inputs, operations, and results for enhanced understanding
//   10. Memory management with swap setup, NUMA optimization, and security enforcement
//   11. Detailed POST checks with CPU features (SSE/AVX) and Secure Boot signature validation
//   12. Kernel parameters including sysctl (vm.swappiness, tcp_congestion_control) and module dependencies
//   13. Storage preparation with filesystem checks (fsck) and read-only rootfs support
//   14. Memory page fault simulation, SELinux policy enforcement, and IOMMU/DMA configuration
//   15. Verbose logging for sub-operations, error simulation, and dmesg-like output
//   16. PCI/PCIe bus scanning with lspci-like device detection
//   17. I/O scheduler setup (e.g., CFQ) and process scheduler (CFS) with nice/ionice
//   18. Initramfs loading for initial RAM filesystem
//   19. Daemon services activation (cron, dbus, udev) with systemd-analyze simulation
//   20. Network stack optimization (Jumbo Frames, TCP congestion, DNS, iptables/nftables)
//   21. Entropy pool initialization with /dev/random and rngd simulation
//   22. UEFI boot flow with EFI stub and efibootmgr configuration

const fs = require('fs').promises;
const readline = require('readline');
const { resolve } = require('path');

// Configuration constants
const CONFIG = {
  LOG_FILE: resolve(__dirname, '..', `system_${new Date().toISOString().split('T')[0]}.log`),
  DELAY_BASE_MS: 200, // Default delay base in milliseconds
  PROGRESS_BAR_LENGTH: 45,
  MAX_BINARY_LENGTH: 8, // Maximum allowed binary length
  VERBOSE_LOGGING: true // Enable detailed logging
};

// Parse command-line arguments
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
const print = (message, color) => console.log(`${COLORS[color]}${message}${COLORS.reset}`);

/**
 * Print an error message to the console with specified color
 * @param {string} message - The error message to print
 * @param {string} color - The ANSI color code key
 */
const printError = (message, color) => console.error(`${COLORS[color]}${message}${COLORS.reset}`);

/**
 * Generate a human-readable timestamp
 * @returns {string} - Formatted timestamp (e.g., "Mar 24, 2025, 14:30:45")
 */
const getFriendlyTimestamp = () => {
  const date = new Date();
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  const time = date.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
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
    let specificErrorCode = errorCode;
    if (err.code === 'ENOENT' && context.includes('checking')) return false;
    if (err.code === 'EACCES') specificErrorCode = 'ACC001';
    else if (err.code === 'ENOMEM') specificErrorCode = 'MEM001';
    else if (err.code === 'EIO') specificErrorCode = 'IO001';
    await logger.logError(`Error in ${context}: ${err.message}`, specificErrorCode, err.stack);
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
        if (err.code === 'ENOENT') await fs.writeFile(this.logFile, logMessage + '\n');
        else throw err;
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
   * @param {string} [level='info'] - Log level
   * @returns {Promise<void>}
   */
  async logStep(message, color, delayMs = CONFIG.DELAY_BASE_MS, level = 'info') {
    print(message, color); // Color applied correctly via COLORS object
    await this.logOperation(message, level);
    await adaptiveDelay(delayMs);
  }

  /**
   * Log verbose information if enabled
   * @param {string} message - The message to log
   * @returns {Promise<void>}
   */
  async logVerbose(message) {
    if (CONFIG.VERBOSE_LOGGING) await this.logOperation(message, 'debug');
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
      if (err.code !== 'ENOENT') await this.logError(`Error checking log file: ${err.message}`, 'LOG002', err.stack);
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
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
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
      if (/^[01]{1,8}$/.test(trimmedInput)) return trimmedInput;
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
      if (operations.includes(operation)) return operation;
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
    return '0';
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
    await logger.logStep('Activating system services (systemd simulation)...', 'magenta');
    await logger.logVerbose('Service: networkd started');
    await logger.logStep('Configuring network stack (TCP/IP initialization)...', 'magenta');
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

  // Simulate power-on and BIOS/UEFI initialization
  async powerOnAndBiosInit() {
    printSeparator('0%: Firmware Initialization');
    await this.logger.logStep('Powering on: Distributing voltage to components...', 'blue');
    await this.logger.logStep('Starting UEFI with EFI stub loader...', 'blue');
    await this.logger.logStep('Running POST: Checking CPU cache...', 'blue');
    await this.logger.logVerbose('CPU cache test passed');
    await this.logger.logStep('Running POST: Validating RAM integrity...', 'blue');
    if (Math.random() < 0.05) throw new Error('RAM integrity check failed');
    await this.logger.logStep('Checking CPU features: SSE, AVX...', 'blue');
    await this.logger.logVerbose('CPU features: SSE4.2, AVX2 enabled');
    await this.logger.logStep('Initializing multi-core CPU support...', 'blue');
    await this.logger.logStep('Configuring system clock and ACPI power management...', 'blue');
    await this.logger.logStep('Enabling Secure Boot: Validating digital signatures...', 'blue');
    await this.logger.logVerbose('Signature verification completed');
    await this.logger.logStep('Configuring efibootmgr boot entries...', 'blue');
    await this.logger.logStep('Firmware ready!', 'blue');
    await this.logger.logOperation('UEFI initialization completed with Secure Boot and EFI stub', 'info');
    setProgress(0);
  }

  //Load bootloader into memory
  async loadBootloader() {
    printSeparator('10%: Bootloader Stage');
    await this.logger.logStep('Scanning for boot device priority (HDD/SSD/USB)...', 'blue');
    await this.logger.logVerbose('Boot priority: SSD > HDD > USB');
    await this.logger.logStep('Reading MBR/GPT partition table...', 'blue');
    await this.logger.logStep('Loading GRUB into RAM (446 bytes)...', 'blue');
    await this.logger.logStep('Parsing GRUB configuration (grub.cfg)...', 'blue');
    await this.logger.logStep('Validating EFI System Partition (ESP)...', 'blue');
    await this.logger.logStep('Bootloader initialized!', 'blue');
    await this.logger.logOperation('Bootloader (GRUB) loaded with GPT support', 'info');
    setProgress(10);
  }

  // Load kernel into Ring 0 with detailed parameters
  async enterRing0AndLoadKernel() {
    printSeparator('20%: Kernel Loading');
    await this.logger.logStep('Transferring kernel to RAM...', 'green');
    await this.logger.logStep('Passing kernel parameters: quiet splash loglevel=3 rd.udev.log_priority=3 apparmor=1 security=apparmor', 'green');
    await this.logger.logStep('Configuring CPU registers (EAX, EBX, FLAGS)...', 'green');
    await this.logger.logVerbose('EAX set to 0x0, FLAGS updated');
    await this.logger.logStep('Setting up Interrupt Vector Table (IVT) and IDT...', 'green');
    await this.logger.logStep('Applying sysctl: vm.swappiness=60, kernel.sched_latency_ns=20000000', 'green');
    await this.logger.logStep('Kernel entered Ring 0!', 'green');
    await this.logger.logOperation('Kernel loaded into Ring 0 with IVT, IDT, and sysctl parameters', 'info');
    setProgress(20);
  }

  // Load initramfs (initial RAM filesystem)
  async loadInitramfs() {
    printSeparator('25%: Initramfs Loading');
    await this.logger.logStep('Loading initramfs image...', 'green');
    await this.logger.logStep('Extracting initramfs into RAM...', 'green');
    await this.logger.logStep('Initializing entropy pool for /dev/random via rngd...', 'green');
    await this.logger.logVerbose('Entropy pool filled with 4096 bits');
    await this.logger.logStep('Initramfs ready!', 'green');
    await this.logger.logOperation('Initramfs loaded with entropy pool initialized', 'info');
    setProgress(25);
  }

  // Load kernel modules with PCI/PCIe scanning
  async loadKernelModules() {
    printSeparator('30%: Kernel Modules');
    await this.logger.logStep('Initializing kernel module loader...', 'green');
    await this.logger.logStep('Resolving module dependencies...', 'green');
    await this.logger.logVerbose('Dependencies: usbcore -> usbhid');
    await this.logger.logStep('Scanning PCI/PCIe bus (lspci simulation)...', 'green');
    await this.logger.logVerbose('Detected devices: GPU (NVIDIA), Network Card (Intel), USB Controller');
    await this.logger.logStep('Initializing ACPI and APIC...', 'green');
    await this.logger.logStep('Linking device drivers (GPU, USB, Network)...', 'green');
    await this.logger.logStep('Dynamically loading filesystem support (ext4/NTFS)...', 'green');
    await this.logger.logStep('Modules linked successfully!', 'green');
    await this.logger.logOperation('Kernel modules loaded with PCI/PCIe devices linked', 'info');
    setProgress(30);
  }

  // Initialize operating system with advanced features
  async initializeOS() {
    printSeparator('40%: OS Initialization');
    await this.logger.logStep('Running fsck on root filesystem...', 'green');
    await this.logger.logStep('Mounting root filesystem (read-only support)...', 'green');
    await this.logger.logStep('Setting up I/O scheduler: CFQ', 'green');
    await this.logger.logStep('Mounting additional filesystems: /home, /var...', 'green');
    await this.storageManager.clearOldFiles(['output.txt']);
    await this.logger.logStep('Initializing Completely Fair Scheduler (CFS) with nice/ionice...', 'green');
    await this.logger.logStep('Forking init process (PID 1)...', 'green');
    await this.logger.logStep('Starting systemd services: networkd, sshd, cron, dbus, udev...', 'green');
    await this.logger.logVerbose('Service sshd initialized in 0.12s');
    await this.logger.logVerbose('Service cron started in 0.08s');
    await this.logger.logVerbose('Service dbus activated in 0.15s');
    await this.logger.logVerbose('Service udev running in 0.20s');
    await this.logger.logStep('Simulating systemd-analyze: Boot time 1.5s', 'green');
    await this.logger.logStep('OS ready for user-space!', 'green');
    await this.logger.logOperation('OS initialized with CFS, systemd, and filesystem tweaks', 'info');
    setProgress(40);
  }

  // Memory management stage with DMA and NUMA
  async memoryManagement() {
    printSeparator('50%: Memory Management');
    await this.logger.logStep('Initializing virtual memory...', 'blue');
    await this.logger.logStep('Setting up paging tables...', 'blue');
    if (Math.random() < 0.03) throw new Error('Page fault detected');
    await this.logger.logVerbose('Paging table entry updated');
    await this.logger.logStep('Setting up swap space...', 'blue');
    await this.logger.logStep('Optimizing NUMA architecture...', 'blue');
    await this.logger.logStep('Configuring DMA and IOMMU for memory protection...', 'blue');
    await this.logger.logStep('Memory allocation optimized!', 'blue');
    await this.logger.logOperation('Memory management initialized with swap, NUMA, and DMA/IOMMU', 'info');
    setProgress(50);
  }

  // Security and network enforcement stage
  async enforceSecurityAndNetwork() {
    printSeparator('60%: Security & Network Enforcement');
    await this.logger.logStep('Activating SELinux policies...', 'blue');
    await this.logger.logVerbose('Policy: mandatory access control enabled');
    await this.logger.logStep('Configuring process capabilities...', 'blue');
    await this.logger.logStep('Enabling process isolation...', 'blue');
    await this.logger.logStep('Initializing network stack: TCP congestion control (bbr)...', 'blue');
    await this.logger.logStep('Enabling Jumbo Frames...', 'blue');
    await this.logger.logStep('Setting sysctl: net.core.rmem_max=16777216, wmem_max=16777216', 'blue');
    await this.logger.logStep('Configuring /etc/resolv.conf with systemd-resolved...', 'blue');
    await this.logger.logStep('Initializing firewall: nftables rules loaded...', 'blue');
    await this.logger.logStep('Simulating ping/traceroute for network check...', 'blue');
    await this.logger.logVerbose('Ping: 192.168.1.1 - 5ms');
    await this.logger.logStep('Security and network enforced!', 'blue');
    await this.logger.logOperation('Security policies and network stack enforced', 'info');
    setProgress(60);
  }

  // Collect binary inputs from user
  async getInput() {
    printSeparator('70%: User Space Activation');
    await this.logger.logStep('Launching user-space interface...', 'blue');
    print('Awaiting user input:', 'blue');
    const originalBinary1 = await this.inputHandler.getBinaryInput("First binary (e.g., 101, max 8 bits): ");
    const originalBinary2 = await this.inputHandler.getBinaryInput("Second binary (e.g., 110, max 8 bits): ");
    const binary1 = originalBinary1.padStart(CONFIG.MAX_BINARY_LENGTH, '0');
    const binary2 = originalBinary2.padStart(CONFIG.MAX_BINARY_LENGTH, '0');
    const decimal1 = parseInt(binary1, 2);
    const decimal2 = parseInt(binary2, 2);
    const originalDecimal1 = parseInt(originalBinary1, 2);
    const originalDecimal2 = parseInt(originalBinary2, 2);
    print(`Inputs registered: ${binary1} (decimal: ${decimal1}), ${binary2} (decimal: ${decimal2})`, 'blue');
    await this.logger.logOperation(`User inputs: ${originalBinary1} (decimal: ${originalDecimal1}), ${originalBinary2} (decimal: ${originalDecimal2})`, 'info');
    setProgress(70);
    return [binary1, binary2, originalBinary1, originalBinary2];
  }

  // Select operation to perform
  async chooseOperationStage() {
    printSeparator('80%: Operation Selection');
    const operation = await this.inputHandler.chooseOperation();
    print(`Operation selected: ${operation}`, 'yellow');
    await this.logger.logOperation(`Operation chosen: ${operation}`, 'info');
    setProgress(80);
    return operation;
  }

  // Perform the selected operation
  async performOperation(binary1, binary2, operation) {
    printSeparator('90%: CPU Execution');
    const result = await this.processor.performOperation(binary1, binary2, operation, this.logger);
    setProgress(90);
    return result;
  }

  // Store result in simulated RAM
  async storeInRAM(result) {
    printSeparator('95%: RAM Storage');
    await this.logger.logStep('Allocating RAM for result...', 'green');
    const decimalResult = parseInt(result, 2);
    await this.logger.logStep(`Stored in RAM: ${result} (decimal: ${decimalResult})`, 'green');
    await this.logger.logOperation(`Result stored in RAM: ${result} (decimal: ${decimalResult})`, 'info');
    setProgress(95);
  }

  // Display final output with debug logs
  async displayOutput(operation, originalBinary1, originalBinary2, result) {
    printSeparator('100%: System Ready');
    const decimal1 = parseInt(originalBinary1, 2);
    const decimal2 = parseInt(originalBinary2, 2);
    const decimalResult = parseInt(result, 2);
    print(`Operation: ${operation}`, 'yellow');
    print(`Original Input A: ${originalBinary1} (decimal: ${decimal1}) (Full: ${originalBinary1.padStart(CONFIG.MAX_BINARY_LENGTH, '0')})`, 'yellow');
    if (operation !== 'NOT') print(`Original Input B: ${originalBinary2} (decimal: ${decimal2}) (Full: ${originalBinary2.padStart(CONFIG.MAX_BINARY_LENGTH, '0')})`, 'yellow');
    const trimmedResult = result.replace(/^0+/, '') || '0';
    print(`Result: ${trimmedResult} (decimal: ${decimalResult}) (Full: ${result})`, 'yellow');
    await this.logger.logStep('Simulating dmesg: Kernel boot completed', 'green');
    await this.logger.logStep('Simulating journalctl --boot output: Logs ready', 'green');
    print('System fully operational!', 'green');
    await this.logger.logOperation(`System fully booted. Operation: ${operation}, Inputs: ${originalBinary1} (decimal: ${decimal1}), ${originalBinary2} (decimal: ${decimal2}), Result: ${trimmedResult} (decimal: ${decimalResult})`, 'info');
    setProgress(100);
  }

  // Cleanup resources
  async cleanup() {
    await this.logger.logOperation('Cleaning up resources...', 'info');
    this.inputHandler.close();
  }

  // Main simulation execution 
  async run() {
    await this.logger.checkAndClearLogFile();
    print('Initializing Hyper-Realistic OS Simulation...', 'green');
    await adaptiveDelay();

    await this.powerOnAndBiosInit(); // 0%
    await this.loadBootloader(); // 10%
    await this.enterRing0AndLoadKernel(); // 20%
    await this.loadInitramfs(); // 25%
    await this.loadKernelModules(); // 30%
    await this.initializeOS(); // 40%
    await this.memoryManagement(); // 50%
    await this.enforceSecurityAndNetwork(); // 60%
    const [binary1, binary2, originalBinary1, originalBinary2] = await this.getInput(); // 70%
    const operation = await this.chooseOperationStage(); // 80%
    const result = await this.performOperation(binary1, binary2, operation); // 90%
    await this.storeInRAM(result); // 95%
    await this.displayOutput(operation, originalBinary1, originalBinary2, result); // 100%

    print('Simulation Complete - System Online!', 'green');
    await this.cleanup();
    await this.logger.logOperation('SUCCESS', 'info');
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
  if (simulator) await simulator.cleanup();
});