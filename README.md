# 🤖 binary-os-sim

`Hyper-Realistic OS Simulation` is a hyper-realistic CLI tool designed to simulate an operating system's boot process in a visually engaging and interactive manner. Ideal for both educational demonstrations and entertainment, this project showcases the fundamentals of binary operations and system initialization through a detailed, step-by-step simulation.

![License](https://img.shields.io/badge/license-MIT-red.svg)
![Node.js](https://img.shields.io/badge/Node.js-14%2B-green.svg)


## 🚀 Features

- **Hyper-Realistic OS Boot Simulation**  
  Dive into an ultra-detailed emulation of an OS boot process, including UEFI firmware, bootloader, kernel initialization, and user-space activation.

- **Interactive Binary Logic Operations**  
  Perform real-time binary operations (AND, OR, XOR, NOT, NAND, NOR, XNOR) with user inputs, complete with detailed bit-by-bit explanations.

- **Granular Progress Visualization**  
  Track each boot stage with a dynamic progress bar, reflecting intricate steps like kernel module loading and network stack setup.

- **ANSI Color-Coded Terminal Output**  
  Enjoy visually distinct, color-coded messages for every phase—firmware (blue), kernel (green), operations (magenta)—for clarity and engagement.

- **Advanced Logging System**  
  Capture every action with timestamped logs, verbose debugging (e.g., `dmesg`, `journalctl`), and robust error handling with stack traces.

- **Configurable Real-Time Delays**  
  Experience authentic timing with adaptive delays, adjustable via `--speed=<value>`, mimicking real hardware and software interactions.

- **Hardware & Software Realism**  
  Simulate CPU features (SSE/AVX), PCI/PCIe scanning, NUMA/DMA memory management, I/O schedulers (CFQ), and systemd services (cron, udev).

- **Network & Security Enhancements**  
  Features TCP congestion control (BBR), Jumbo Frames, DNS resolution, and firewall rules (nftables) for a complete system experience.


## 📦 Installation

Follow these steps to get started:

1. Clone the repository:
    ```bash
    git clone https://github.com/q1sh101/binary-os-sim.git
    cd binary-os-sim
    ```
2. Run the command:
    ```bash
    npm install
    ```

3. Run the command:
    ```bash
    npm start
    ```

  ### or


1. Run the command:
    ```bash
    npm install -g binary-os-sim
    ```

2. Run the command:
    ```bash
    npx binary-os-sim
    ```

## 💡 Contributing
Contributions are welcome! Feel free to open an issue or submit a pull request.

