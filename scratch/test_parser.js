const fs = require('fs');

const sampleOcrText = `
CSS - Computer System Services (Class Reviewer)
1. Core Fundamentals & Information Processing
The Information Processing Cycle
1. Input: Data or instructions entered into a computer system.
2. Process: The manipulation or computation of data performed by the CPU.
3. Output: The processed data presented to the user (e.g., text on a screen, audio).
2. Hardware Components & System Unit
●
4. CPU (Central Processing Unit): The "brain" of the computer that executes instructions.
● 5. Motherboard: The main printed circuit board connecting all components of a computer.
● 6. System Unit: The main chassis or case that houses the internal components of a computer.
● 7. RAM (Random Access Memory): Volatile, high-speed short-term memory used to store active data.
● 8. ROM (Read-Only Memory): Non-volatile memory containing permanent data like the system BIOS.
● 9. PSU (Power Supply Unit): Converts electrical power from an outlet into usable power for the computer.
● 10. GPU (Graphics Processing Unit): A specialized processor designed to accelerate graphics rendering.
● 11. SSD (Solid State Drive): Fast, non-volatile storage that uses flash memory.
● 12. HDD (Hard Disk Drive): Traditional, slower storage that uses spinning magnetic platters.
○ 3.5": The standard physical drive size for desktop HDDs.
○ 2.5": The standard physical drive size for laptop HDDs and SSDs.
● 13. Hardware: The physical, tangible components of a computer system.
System Unit Diagram Components
Internal & External Components Connected to the Case:
● Power Supply
● DVD ROM Drive
● Mainboard
● CPU
● CPU Fan
● RAM
● VGA Card
● Sound Card
● Harddisk
● Reader all-in-one Internal
● Mouse
● Keyboard
● Speaker
● Monitor
3. Advanced Hardware & Expansion
●
52. Cache: High-speed, temporary CPU memory used to speed up data retrieval.
● 53. Bus: A communication system that transfers data between components inside a computer.
● 54. BIOS (Basic Input/Output System): Firmware used to perform hardware initialization during booting.
● 55. UEFI (Unified Extensible Firmware Interface): A modern replacement for BIOS with faster boot times and more features.
● 56. Peripherals: Auxiliary devices used to put information into and get information out of the computer (e.g., keyboard, mouse).
● 57. Overclocking: Running a component (like a CPU or GPU) at a higher speed than its factory rating.
● 58. Form Factor: The physical size, shape, and layout specification of hardware like motherboards and cases.
● 59. Heat Sink: A passive heat exchanger that cools a component by dissipating heat into the air.
● 60. NVMe: A modern, ultra-fast protocol designed for reading and writing data on solid-state drives.
4. Keyboard Functions, Shortcuts & Layouts
Basic Control Keys
Shortcut Action
CTRL + Z Undo
CTRL + X Cut
CTRL + C Copy
CTRL + V Paste
CTRL + A Select All
CTRL + S Save
CTRL + F Find
CTRL + G Go To
CTRL + H Replace
CTRL + P Print
Keyboard Key Groups & Symbols
● F-KEYS: F1–F12
● COMPOSITION OF ALPHANUMERIC CHARACTERS:
1. Alphabets
2. Numbers
3. Symbols
4. Punctuations
5. Special Keys
● SYMBOLS & PUNCTUATIONS:
○ ! Exclamation mark
○ @ At sign
○ # Hash
○ $ Dollar
○ % Percentage
○ ^ Caret
○ & Ampersand
○ * Asterisk
○ () Brackets
○ \` Grave accent
○ ~ Tilde
● SPECIAL KEYS: Insert, Delete, Home, End, Page Up, Page Down, Print Screen, Pause/Break, Esc, Shift
● CURSOR / ARROW KEYS: Used to move cursor direction
● NUMERIC KEYPAD: Used to fast number entry
5. Software & Systems
●
15. OS (Operating System): System software that manages computer hardware and software resources.
● 16. Windows: A widely used proprietary operating system developed by Microsoft.
● 17. macOS: The proprietary operating system developed by Apple for Mac computers.
● 18. Linux: An open-source, Unix-like operating system kernel used widely in servers.
● 19. Open Source: Software with source code that anyone can inspect, modify, and enhance.
● 20. Software: A collection of instructions or programs that tell hardware what to do.
● 21. Bug: An error, flaw, or fault in a software program that causes it to behave unexpectedly.
● 22. Patch: A software update designed to fix bugs, security vulnerabilities, or improve performance.
● 23. Extension Name: The suffix at the end of a filename indicating its format (e.g., .txt).
○ .exe: An executable file extension used primarily in Windows to run programs.
○ .jpg: A commonly used lossy compression format for digital images.
○ .png: A raster graphics file format that supports lossless data compression and transparency.
○ .svg: A vector image format used for two-dimensional graphics that can scale infinitely.
6. Software Logic, Programming & Interfaces
●
62. Compiler: A program that translates human-readable source code into machine code.
● 63. Algorithm: A step-by-step set of operations or rules to be followed in calculations or problem-solving.
● 64. Firmware: Software programmed permanently into a hardware device's read-only memory.
● 65. Database: An organized collection of structured data stored electronically.
● 66. API (Application Programming Interface): A set of rules that allows different software applications to communicate with each other.
● 67. Variable: A storage location in programming paired with an associated symbolic name that contains data.
● 68. IDE (Integrated Development Environment): A software suite providing comprehensive facilities to programmers for coding.
● 69. GUI (Graphical User Interface): A visual way of interacting with a computer using items such as windows, icons, and menus.
● 70. CLI (Command Line Interface): A text-based user interface used to view and manage computer files.
7. Display & Performance
●
28. Pixel: The smallest controllable element of a picture represented on a screen.
● 29. Resolution: The number of pixels displayed on a screen, expressed as width × height.
● 30. Refresh Rate: How many times per second a display updates its image, measured in Hertz (Hz).
● 31. Frame Rate: The frequency at which consecutive images (frames) are displayed, measured in FPS.
● 32. Bottleneck: A performance limitation caused by one component dragging down the speed of the entire system.
8. Data Units & Numbering Systems
●
33. Binary: A base-2 numbering system consisting entirely of 0s and 1s used by computers.
● 71. Hexadecimal: A base-16 numbering system used in computing to simplify binary representations.
Data Units Hierarchy
● Bit: The smallest unit of data in a computer, representing a 0 or a 1.
● Byte: A group of 8 bits, typically representing a single character of text.
● KB (Kilobyte): A unit of data equal to 1,024 bytes.
● MB (Megabyte): A unit of data equal to 1,024 kilobytes.
● GB (Gigabyte): A unit of data equal to 1,024 megabytes.
● TB (Terabyte): A unit of data equal to 1,024 kilobytes.
● PB (Petabyte): A unit of data equal to 1,024 terabytes.
9. Networking
●
41. Network: A collection of computers and devices connected together to share data.
● 42. LAN (Local Area Network): A network confined to a small geographic area, like a home or office.
● 43. WLAN (Wireless Local Area Network): A local network that relies on wireless communication (Wi-Fi).
● 44. PAN (Personal Area Network): A short-range network centered around an individual (e.g., Bluetooth).
● 45. Cloud: Internet-based computing resources, storage, and servers accessed remotely.
10. Cybersecurity, Threats & Communication
●
46. Malware: Malicious software designed to disrupt, damage, or gain unauthorized access to a computer.
● 47. Virus: Malicious code that attaches to legitimate files and requires human action to spread.
● 48. Worm: Standalone malware that replicates itself automatically across networks.
● 49. Trojan Horse: Malicious software disguised as a legitimate, safe program.
● 50. Ransomware: Malware that encrypts a user's files and demands payment for the decryption key.
● 51. Morse Code: A method of telecommunication that encodes text characters as sequences of dots and dashes.
`;

const appJs = fs.readFileSync(__dirname + '/../app.js', 'utf8');

// Extract parseTermsFromText function string
const match = appJs.match(/const parseTermsFromText = \(text\) => {[\s\S]*?\n};/);
if (!match) {
  console.error("Could not find parseTermsFromText function!");
  process.exit(1);
}

const fnCode = match[0] + "\nreturn parseTermsFromText;";
const parseTermsFromText = new Function(fnCode)();

const terms = parseTermsFromText(sampleOcrText);
console.log("Extracted terms count:", terms.length);
console.log("All extracted terms:\n", terms.map((t, idx) => `${idx + 1}. [${t.term}] => ${t.def.slice(0, 35)}...`).join('\n'));
