# Nightmare Desktop OS

A browser-based desktop operating system environment built with pure HTML5, CSS3, and JavaScript (no frameworks).

## Features

- **Window Manager** – open, close, minimize, maximize, drag, and resize windows
- **Taskbar** – running app buttons, Start menu launcher, and live clock
- **Start Menu** – launch any app from one place, with a Shut Down option
- **Desktop Icons** – double-click or press Enter to launch apps
- **Right-click Context Menu** – quick access to Settings or a new Text Editor file

## Built-in Applications

| App | Description |
|-----|-------------|
| 🦊 **Mozilla Firefox** | Integrated browser launcher – enter any URL and open it in a new tab, or try embedding supported sites |
| 📁 **File Manager** | Navigate a virtual file system with sidebar bookmarks |
| 📝 **Text Editor** | Full-featured editor with line/column counter and file download |
| 💻 **Terminal** | Command-line emulator with `ls`, `cd`, `cat`, `echo`, `neofetch`, and more |
| 🔢 **Calculator** | Standard calculator with expression display |
| ⚙️ **Settings** | Customise accent colour, UI scale, and font |

## Getting Started

No build step required – just open `index.html` in a modern browser:

```
open index.html
```

Or serve with any static file server:

```bash
npx serve .
# then visit http://localhost:3000
```

## Project Structure

```
Nightmare-Desktop-OS/
├── index.html          # Main HTML shell
├── style.css           # All styles (desktop, windows, apps, taskbar)
├── desktop.js          # Window manager, app registry, all built-in apps
└── assets/
    └── icons/          # SVG icons for each application
```
