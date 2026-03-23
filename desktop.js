/**
 * Nightmare Desktop OS – Main JavaScript
 * Handles: window management, app launching, taskbar, start menu,
 *          clock, context menu, drag/resize, and all built-in apps.
 */

'use strict';

/* ── App Registry ─────────────────────────────────────────────────── */
const APP_REGISTRY = {
  firefox: {
    title: 'Mozilla Firefox',
    icon:  'assets/icons/firefox.svg',
    width: 900,
    height: 620,
    build: buildFirefox,
  },
  filemanager: {
    title: 'File Manager',
    icon:  'assets/icons/filemanager.svg',
    width: 700,
    height: 480,
    build: buildFileManager,
  },
  texteditor: {
    title: 'Text Editor',
    icon:  'assets/icons/texteditor.svg',
    width: 640,
    height: 480,
    build: buildTextEditor,
  },
  terminal: {
    title: 'Terminal',
    icon:  'assets/icons/terminal.svg',
    width: 640,
    height: 400,
    build: buildTerminal,
  },
  calculator: {
    title: 'Calculator',
    icon:  'assets/icons/calculator.svg',
    width: 300,
    height: 430,
    build: buildCalculator,
  },
  settings: {
    title: 'Settings',
    icon:  'assets/icons/settings.svg',
    width: 560,
    height: 420,
    build: buildSettings,
  },
};

/* ── State ────────────────────────────────────────────────────────── */
let windowZBase    = 100;   // incremented when a window is focused
let openWindows    = {};    // id → { el, app, minimized, maximized, prevRect }
let activeWindowId = null;

/* ── Boot ─────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  startClock();
  bindDesktopIcons();
  bindTaskbar();
  bindStartMenu();
  bindContextMenu();

  // Open Firefox on boot
  setTimeout(() => launchApp('firefox'), 300);
});

/* ── Clock ────────────────────────────────────────────────────────── */
function startClock() {
  const el = document.getElementById('clock');
  function tick() {
    const now = new Date();
    el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      + '  '
      + now.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  tick();
  setInterval(tick, 60000);
}

/* ── Desktop Icons ────────────────────────────────────────────────── */
function bindDesktopIcons() {
  document.querySelectorAll('.desktop-icon').forEach(icon => {
    icon.addEventListener('dblclick', () => launchApp(icon.dataset.app));
    icon.addEventListener('keydown',  e => {
      if (e.key === 'Enter' || e.key === ' ') launchApp(icon.dataset.app);
    });
    // single click = select
    icon.addEventListener('click', e => {
      e.stopPropagation();
      document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
      icon.classList.add('selected');
    });
  });
  // click on desktop deselects icons
  document.getElementById('desktop').addEventListener('click', () => {
    document.querySelectorAll('.desktop-icon').forEach(i => i.classList.remove('selected'));
  });
}

/* ── Taskbar ──────────────────────────────────────────────────────── */
function bindTaskbar() {
  const startBtn = document.getElementById('startBtn');
  const startMenu = document.getElementById('startMenu');

  startBtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = !startMenu.classList.contains('hidden');
    startMenu.classList.toggle('hidden', open);
    startBtn.setAttribute('aria-expanded', String(!open));
  });

  document.addEventListener('click', () => {
    startMenu.classList.add('hidden');
    startBtn.setAttribute('aria-expanded', 'false');
  });
}

/* ── Start Menu ───────────────────────────────────────────────────── */
function bindStartMenu() {
  const startMenu = document.getElementById('startMenu');
  startMenu.addEventListener('click', e => e.stopPropagation());

  startMenu.querySelectorAll('[data-app]').forEach(item => {
    const launch = () => {
      launchApp(item.dataset.app);
      startMenu.classList.add('hidden');
    };
    item.addEventListener('click', launch);
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') launch();
    });
  });

  document.getElementById('shutdownBtn').addEventListener('click', shutdown);
}

/* ── Context Menu ─────────────────────────────────────────────────── */
function bindContextMenu() {
  const menu = document.getElementById('contextMenu');

  document.getElementById('desktop').addEventListener('contextmenu', e => {
    // only fire on desktop/icon area, not windows
    if (e.target.closest('.window')) return;
    e.preventDefault();
    menu.style.left = Math.min(e.clientX, window.innerWidth  - 180) + 'px';
    menu.style.top  = Math.min(e.clientY, window.innerHeight - 120) + 'px';
    menu.classList.remove('hidden');
  });

  document.addEventListener('click', () => menu.classList.add('hidden'));

  menu.querySelectorAll('li').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      if (action === 'settings') launchApp('settings');
      else if (action === 'newfile') launchApp('texteditor');
      // refresh is a no-op in a web app
      menu.classList.add('hidden');
    });
  });
}

/* ── Window Management ────────────────────────────────────────────── */
function launchApp(appId) {
  const def = APP_REGISTRY[appId];
  if (!def) return;

  // If already open (and not minimized), focus it
  const existing = Object.values(openWindows).find(w => w.appId === appId && !w.minimized);
  if (existing) {
    focusWindow(existing.id);
    return;
  }

  const id  = appId + '_' + Date.now();
  const win = createWindow(id, def);
  openWindows[id] = { id, appId, el: win, minimized: false, maximized: false, prevRect: null };

  addTaskbarEntry(id, def);
  focusWindow(id);
}

function createWindow(id, def) {
  const container = document.getElementById('windowContainer');
  const desktop   = document.getElementById('desktop');

  // Stagger placement
  const existingCount = Object.keys(openWindows).length;
  const offset = existingCount * 28;
  const maxLeft = desktop.clientWidth  - def.width  - 20;
  const maxTop  = desktop.clientHeight - def.height - 20;
  const left    = Math.max(20, Math.min(120 + offset, maxLeft));
  const top     = Math.max(20, Math.min(60  + offset, maxTop));

  const win = document.createElement('div');
  win.className = 'window';
  win.id = id;
  win.style.width  = def.width  + 'px';
  win.style.height = def.height + 'px';
  win.style.left   = left + 'px';
  win.style.top    = top  + 'px';

  // Title bar
  const titlebar = document.createElement('div');
  titlebar.className = 'window-titlebar';

  const icon = document.createElement('img');
  icon.src = def.icon;
  icon.className = 'window-title-icon';
  icon.alt = '';

  const title = document.createElement('span');
  title.className = 'window-title-text';
  title.textContent = def.title;

  const controls = document.createElement('div');
  controls.className = 'window-controls';
  controls.innerHTML = `
    <button class="window-btn btn-minimize" title="Minimize">─</button>
    <button class="window-btn btn-maximize" title="Maximize">□</button>
    <button class="window-btn btn-close"    title="Close">✕</button>
  `;

  titlebar.append(icon, title, controls);

  // Body
  const body = document.createElement('div');
  body.className = 'window-body';
  def.build(body, id);

  // Resize handle
  const resizeHandle = document.createElement('div');
  resizeHandle.className = 'window-resize';

  win.append(titlebar, body, resizeHandle);
  container.appendChild(win);

  // Bind controls
  controls.querySelector('.btn-minimize').addEventListener('click', e => {
    e.stopPropagation(); minimizeWindow(id);
  });
  controls.querySelector('.btn-maximize').addEventListener('click', e => {
    e.stopPropagation(); toggleMaximize(id);
  });
  controls.querySelector('.btn-close').addEventListener('click', e => {
    e.stopPropagation(); closeWindow(id);
  });

  // Focus on click
  win.addEventListener('mousedown', () => focusWindow(id), true);

  // Drag
  makeDraggable(win, titlebar, id);

  // Resize
  makeResizable(win, resizeHandle, id);

  return win;
}

function focusWindow(id) {
  if (activeWindowId === id) return;
  // Deactivate previous
  if (activeWindowId && openWindows[activeWindowId]) {
    openWindows[activeWindowId].el.classList.remove('active');
    const tb = document.querySelector(`#taskbarApps .taskbar-app[data-window="${activeWindowId}"]`);
    if (tb) tb.classList.remove('active');
  }
  activeWindowId = id;
  const entry = openWindows[id];
  if (!entry) return;
  entry.el.classList.add('active');
  entry.el.style.zIndex = ++windowZBase;

  const tb = document.querySelector(`#taskbarApps .taskbar-app[data-window="${id}"]`);
  if (tb) tb.classList.add('active');

  // Un-minimise if needed
  if (entry.minimized) {
    entry.minimized = false;
    entry.el.classList.remove('minimized');
  }
}

function minimizeWindow(id) {
  const entry = openWindows[id];
  if (!entry) return;
  entry.minimized = true;
  entry.el.classList.add('minimized');
  entry.el.classList.remove('active');
  if (activeWindowId === id) activeWindowId = null;

  const tb = document.querySelector(`#taskbarApps .taskbar-app[data-window="${id}"]`);
  if (tb) tb.classList.remove('active');
}

function toggleMaximize(id) {
  const entry = openWindows[id];
  if (!entry) return;
  if (entry.maximized) {
    // Restore
    entry.maximized = false;
    entry.el.classList.remove('maximized');
    if (entry.prevRect) {
      const r = entry.prevRect;
      entry.el.style.left   = r.left   + 'px';
      entry.el.style.top    = r.top    + 'px';
      entry.el.style.width  = r.width  + 'px';
      entry.el.style.height = r.height + 'px';
    }
  } else {
    // Save current rect
    entry.prevRect = {
      left:   parseInt(entry.el.style.left),
      top:    parseInt(entry.el.style.top),
      width:  entry.el.offsetWidth,
      height: entry.el.offsetHeight,
    };
    entry.maximized = true;
    entry.el.classList.add('maximized');
  }
}

function closeWindow(id) {
  const entry = openWindows[id];
  if (!entry) return;
  entry.el.remove();
  delete openWindows[id];

  // Remove taskbar entry
  const tb = document.querySelector(`#taskbarApps .taskbar-app[data-window="${id}"]`);
  if (tb) tb.remove();

  if (activeWindowId === id) activeWindowId = null;
}

function addTaskbarEntry(id, def) {
  const bar  = document.getElementById('taskbarApps');
  const btn  = document.createElement('div');
  btn.className = 'taskbar-app';
  btn.dataset.window = id;
  btn.innerHTML = `<img src="${def.icon}" alt="" /><span>${def.title}</span>`;
  btn.addEventListener('click', () => {
    const entry = openWindows[id];
    if (!entry) return;
    if (entry.minimized) {
      focusWindow(id);
    } else if (activeWindowId === id) {
      minimizeWindow(id);
    } else {
      focusWindow(id);
    }
  });
  bar.appendChild(btn);
}

/* ── Drag ─────────────────────────────────────────────────────────── */
function makeDraggable(win, handle, id) {
  let dragging = false, ox = 0, oy = 0;

  handle.addEventListener('mousedown', e => {
    const entry = openWindows[id];
    if (entry && entry.maximized) return;   // can't drag maximized
    dragging = true;
    ox = e.clientX - win.offsetLeft;
    oy = e.clientY - win.offsetTop;
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const maxX = window.innerWidth  - win.offsetWidth;
    const maxY = window.innerHeight - win.offsetHeight - 44; // taskbar
    win.style.left = Math.max(0, Math.min(e.clientX - ox, maxX)) + 'px';
    win.style.top  = Math.max(0, Math.min(e.clientY - oy, maxY)) + 'px';
  });

  document.addEventListener('mouseup', () => { dragging = false; });
}

/* ── Resize ───────────────────────────────────────────────────────── */
function makeResizable(win, handle, id) {
  let resizing = false, ox = 0, oy = 0, ow = 0, oh = 0;

  handle.addEventListener('mousedown', e => {
    const entry = openWindows[id];
    if (entry && entry.maximized) return;
    resizing = true;
    ox = e.clientX;
    oy = e.clientY;
    ow = win.offsetWidth;
    oh = win.offsetHeight;
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousemove', e => {
    if (!resizing) return;
    const nw = Math.max(320, ow + (e.clientX - ox));
    const nh = Math.max(200, oh + (e.clientY - oy));
    win.style.width  = nw + 'px';
    win.style.height = nh + 'px';
  });

  document.addEventListener('mouseup', () => { resizing = false; });
}

/* ── Shutdown ─────────────────────────────────────────────────────── */
function shutdown() {
  document.getElementById('startMenu').classList.add('hidden');
  const overlay = document.getElementById('shutdownOverlay');
  overlay.classList.remove('hidden');
  setTimeout(() => {
    overlay.innerHTML = '<div class="shutdown-box"><p>It is now safe to close your browser tab.</p></div>';
  }, 2200);
}

/* ═══════════════════════════════════════════════════════════════════
   Built-in Apps
   ═══════════════════════════════════════════════════════════════════ */

/* ── Firefox ──────────────────────────────────────────────────────── */
function buildFirefox(body, winId) {
  body.innerHTML = `
    <div class="app-firefox">
      <div class="browser-bar">
        <button class="browser-nav-btn" id="${winId}-back"  title="Back">◀</button>
        <button class="browser-nav-btn" id="${winId}-fwd"   title="Forward">▶</button>
        <button class="browser-nav-btn" id="${winId}-reload" title="Reload">↺</button>
        <input  class="browser-url"     id="${winId}-url" type="text" value="https://www.mozilla.org/firefox/" spellcheck="false" />
        <button class="browser-go"      id="${winId}-go">Go</button>
      </div>
      <div id="${winId}-viewport" class="browser-blocked">
        <img src="assets/icons/firefox.svg" alt="Firefox" />
        <h2>Mozilla Firefox</h2>
        <p>Browser sandboxing prevents embedding most websites.<br/>
           Click the button below to open Firefox in a new tab.</p>
        <a id="${winId}-openTab" href="https://www.mozilla.org/firefox/" target="_blank" rel="noopener noreferrer">
          Open Firefox Website ↗
        </a>
      </div>
    </div>`;

  const urlInput  = document.getElementById(`${winId}-url`);
  const viewport  = document.getElementById(`${winId}-viewport`);
  const openTabLink = document.getElementById(`${winId}-openTab`);

  function navigate() {
    let url = urlInput.value.trim();
    if (!url) return;

    // Prepend https:// for bare hostnames
    if (!/^https?:\/\//i.test(url) && !url.startsWith('//')) {
      url = 'https://' + url;
    }

    // Only allow http and https schemes to prevent javascript:/data: injection
    let parsed;
    try { parsed = new URL(url); } catch { return; }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;

    urlInput.value = url;
    openTabLink.href = url;
    openTabLink.textContent = 'Open in New Tab ↗';
    viewport.querySelector('p').textContent =
      'Browser sandboxing prevents embedding most websites. Click the button below to visit the page.';

    // Set src via element property (not innerHTML) to avoid XSS via attribute injection
    const frame = document.createElement('iframe');
    frame.className = 'browser-frame';
    frame.title = 'Browser';
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
    frame.src = url;
    viewport.innerHTML = '';
    viewport.appendChild(frame);
  }

  document.getElementById(`${winId}-go`).addEventListener('click', navigate);
  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') navigate(); });
  document.getElementById(`${winId}-back`).addEventListener('click', () => {
    try { viewport.querySelector('iframe')?.contentWindow?.history.back(); } catch {}
  });
  document.getElementById(`${winId}-fwd`).addEventListener('click', () => {
    try { viewport.querySelector('iframe')?.contentWindow?.history.forward(); } catch {}
  });
  document.getElementById(`${winId}-reload`).addEventListener('click', () => {
    try { viewport.querySelector('iframe')?.contentWindow?.location.reload(); } catch {}
  });
}

/* ── File Manager ─────────────────────────────────────────────────── */
const FS = {
  Home:      [{ name: 'Documents', type: 'folder' }, { name: 'Downloads', type: 'folder' },
              { name: 'Pictures',  type: 'folder' }, { name: 'Music',     type: 'folder' },
              { name: 'Videos',    type: 'folder' }, { name: 'readme.txt',type: 'file'   }],
  Documents: [{ name: 'report.docx', type: 'file' }, { name: 'notes.txt', type: 'file' }],
  Downloads: [{ name: 'firefox-setup.exe', type: 'file' }, { name: 'photo.jpg', type: 'file' }],
  Pictures:  [{ name: 'wallpaper.png', type: 'file' }, { name: 'screenshot.png', type: 'file' }],
  Music:     [{ name: 'soundtrack.mp3', type: 'file' }],
  Videos:    [{ name: 'demo.mp4', type: 'file' }],
};

function buildFileManager(body) {
  let currentDir = 'Home';

  body.innerHTML = `
    <div class="app-filemanager">
      <div class="fm-toolbar">
        <button id="fm-up">↑ Up</button>
        <span class="fm-path" id="fm-path">Home</span>
      </div>
      <div class="fm-body">
        <div class="fm-sidebar">
          <ul>
            <li data-dir="Home"      class="active">🏠 Home</li>
            <li data-dir="Documents">📄 Documents</li>
            <li data-dir="Downloads">⬇ Downloads</li>
            <li data-dir="Pictures" >🖼 Pictures</li>
            <li data-dir="Music"    >🎵 Music</li>
            <li data-dir="Videos"   >🎬 Videos</li>
          </ul>
        </div>
        <div class="fm-files" id="fm-files"></div>
      </div>
    </div>`;

  function render(dir) {
    currentDir = dir;
    document.getElementById('fm-path').textContent = dir;
    const filesEl = document.getElementById('fm-files');
    filesEl.innerHTML = '';
    document.querySelectorAll('.fm-sidebar li').forEach(li =>
      li.classList.toggle('active', li.dataset.dir === dir));

    (FS[dir] || []).forEach(item => {
      const el = document.createElement('div');
      el.className = 'fm-file';
      el.innerHTML = `<span class="fm-icon">${item.type === 'folder' ? '📁' : fileIcon(item.name)}</span><span>${item.name}</span>`;
      if (item.type === 'folder') {
        el.addEventListener('dblclick', () => render(item.name));
      }
      filesEl.appendChild(el);
    });
  }

  body.querySelector('#fm-up').addEventListener('click', () => {
    if (currentDir !== 'Home') render('Home');
  });
  body.querySelectorAll('.fm-sidebar li').forEach(li =>
    li.addEventListener('click', () => render(li.dataset.dir)));

  render('Home');
}

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = { txt: '📝', docx: '📄', pdf: '📑', jpg: '🖼', png: '🖼',
                mp3: '🎵', mp4: '🎬', exe: '⚙️', zip: '🗜' };
  return map[ext] || '📄';
}

/* ── Text Editor ──────────────────────────────────────────────────── */
function buildTextEditor(body) {
  body.innerHTML = `
    <div class="app-texteditor">
      <div class="te-toolbar">
        <button id="te-new">New</button>
        <button id="te-save">Save (Download)</button>
      </div>
      <textarea class="te-editor" id="te-area" placeholder="Start typing…" spellcheck="false"></textarea>
      <div class="te-statusbar" id="te-status">Ln 1, Col 1 | 0 chars</div>
    </div>`;

  const area   = body.querySelector('#te-area');
  const status = body.querySelector('#te-status');

  function updateStatus() {
    const text  = area.value;
    const lines = text.slice(0, area.selectionStart).split('\n');
    const ln    = lines.length;
    const col   = lines[lines.length - 1].length + 1;
    status.textContent = `Ln ${ln}, Col ${col} | ${text.length} chars`;
  }

  area.addEventListener('input', updateStatus);
  area.addEventListener('keyup', updateStatus);
  area.addEventListener('click', updateStatus);

  body.querySelector('#te-new').addEventListener('click', () => {
    if (area.value && !confirm('Discard current content?')) return;
    area.value = '';
    updateStatus();
  });

  body.querySelector('#te-save').addEventListener('click', () => {
    const blob = new Blob([area.value], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'document.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

/* ── Terminal ─────────────────────────────────────────────────────── */
const TERM_FS = {
  '/':         ['home', 'etc', 'usr', 'bin'],
  '/home':     ['user'],
  '/home/user':['documents', 'downloads', 'pictures', '.bashrc'],
  '/etc':      ['hosts', 'passwd'],
  '/usr':      ['bin', 'lib'],
  '/bin':      ['bash', 'ls', 'cat', 'echo'],
};

function buildTerminal(body) {
  let cwd  = '/home/user';
  let hist = [];
  let histIdx = -1;

  body.innerHTML = `
    <div class="app-terminal">
      <div class="term-output" id="term-output">
        <span class="term-info">Nightmare Desktop OS Terminal v1.0</span>\n
        <span class="term-info">Type <strong>help</strong> for available commands.</span>\n\n
      </div>
      <div class="term-input-row">
        <span class="term-prompt-label" id="term-prompt">user@nightmare:~$</span>
        <input class="term-input" id="term-input" type="text" autocomplete="off" spellcheck="false" autofocus />
      </div>
    </div>`;

  const output = body.querySelector('#term-output');
  const input  = body.querySelector('#term-input');
  const prompt = body.querySelector('#term-prompt');

  function cwdLabel() {
    const home = '/home/user';
    return cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd;
  }

  function println(text, cls) {
    const span = document.createElement('span');
    if (cls) span.className = cls;
    span.innerHTML = text;
    output.appendChild(span);
    output.appendChild(document.createTextNode('\n'));
    output.scrollTop = output.scrollHeight;
  }

  function printPromptLine(cmd) {
    println(`<span class="term-prompt">user@nightmare:${cwdLabel()}$</span> ${escapeHtml(cmd)}`);
  }

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function resolve(path) {
    if (path.startsWith('/')) return path;
    if (path === '~')  return '/home/user';
    if (path === '..')  {
      const parts = cwd.split('/').filter(Boolean);
      parts.pop();
      return '/' + parts.join('/') || '/';
    }
    return (cwd === '/' ? '' : cwd) + '/' + path;
  }

  function run(line) {
    const parts = line.trim().split(/\s+/);
    const cmd   = parts[0];
    const args  = parts.slice(1);

    switch (cmd) {
      case '':
        break;

      case 'help':
        println('Available commands:', 'term-info');
        println('  help, clear, echo &lt;text&gt;, ls [path], cd &lt;dir&gt;,');
        println('  pwd, cat &lt;file&gt;, uname, whoami, date, hostname,');
        println('  neofetch, uptime, ps, shutdown');
        break;

      case 'clear':
        output.innerHTML = '';
        break;

      case 'echo':
        println(escapeHtml(args.join(' ')));
        break;

      case 'pwd':
        println(cwd);
        break;

      case 'whoami':
        println('user');
        break;

      case 'hostname':
        println('nightmare-desktop');
        break;

      case 'uname':
        println('Nightmare Desktop OS 1.0.0 (web) x86_64');
        break;

      case 'date':
        println(new Date().toString());
        break;

      case 'uptime':
        println('up 0 days, 0 hours, 0 minutes');
        break;

      case 'ls': {
        const target = args[0] ? resolve(args[0]) : cwd;
        const entries = TERM_FS[target];
        if (!entries) { println(`ls: cannot access '${escapeHtml(target)}': No such file or directory`, 'term-error'); break; }
        println(entries.map(e => {
          const isDir = TERM_FS[target + '/' + e] || TERM_FS['/' + e];
          return isDir ? `<span style="color:#7b2fff">${e}/</span>` : e;
        }).join('  '));
        break;
      }

      case 'cd': {
        const target = args[0] ? resolve(args[0]) : '/home/user';
        if (TERM_FS[target] !== undefined) {
          cwd = target;
          prompt.textContent = `user@nightmare:${cwdLabel()}$`;
        } else {
          println(`cd: ${escapeHtml(target)}: No such file or directory`, 'term-error');
        }
        break;
      }

      case 'cat': {
        const file = args[0];
        if (!file) { println('cat: missing file operand', 'term-error'); break; }
        const known = { '.bashrc': '# Nightmare Desktop OS .bashrc\nexport PATH="$PATH:/usr/bin"\nalias ll="ls -la"' };
        if (known[file]) { println(escapeHtml(known[file])); }
        else { println(`cat: ${escapeHtml(file)}: No such file or directory`, 'term-error'); }
        break;
      }

      case 'neofetch':
        println(`
<span style="color:var(--accent)">    ██╗  ██╗██╗██████╗ ███████╗</span>
<span style="color:var(--accent)">    ██║  ██║██║██╔══██╗██╔════╝</span>
<span style="color:var(--accent)">    ███████║██║██║  ██║█████╗  </span>
<span style="color:var(--accent)">    ██╔══██║██║██║  ██║██╔══╝  </span>
<span style="color:var(--accent)">    ██║  ██║██║██████╔╝███████╗</span>
<span style="color:var(--accent)">    ╚═╝  ╚═╝╚═╝╚═════╝ ╚══════╝</span>

<strong>OS:</strong>       Nightmare Desktop OS 1.0
<strong>Shell:</strong>    nightmare-sh 1.0
<strong>Browser:</strong>  Chromium / Firefox
<strong>Memory:</strong>   Browser environment
<strong>Theme:</strong>    Nightmare Purple Dark
        `);
        break;

      case 'ps':
        println('PID   CMD');
        println('1     nightmare-desktop');
        println('2     wm (window manager)');
        println('3     taskbar');
        println('4     terminal');
        break;

      case 'shutdown':
        println('Initiating shutdown sequence…', 'term-info');
        setTimeout(shutdown, 600);
        break;

      default:
        println(`${escapeHtml(cmd)}: command not found`, 'term-error');
    }
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const line = input.value;
      input.value = '';
      printPromptLine(line);
      if (line.trim()) hist.unshift(line);
      histIdx = -1;
      run(line);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (histIdx < hist.length - 1) { histIdx++; input.value = hist[histIdx]; }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx > 0) { histIdx--; input.value = hist[histIdx]; }
      else { histIdx = -1; input.value = ''; }
    }
  });
}

/* ── Safe Calculator Expression Evaluator ─────────────────────────── */
/**
 * Evaluates a simple arithmetic expression string (+, -, *, /)
 * without using eval() or the Function() constructor.
 * Implements a recursive-descent parser: expr → term ((+|-) term)*
 *                                         term → factor ((*|/) factor)*
 *                                         factor → number
 */
function safeCalc(exprStr) {
  const tokens = exprStr.replace(/\s+/g, '').match(/(\d+\.?\d*|[+\-*/])/g);
  if (!tokens) throw new Error('Invalid');
  let pos = 0;

  function peek()   { return tokens[pos]; }
  function consume(){ return tokens[pos++]; }

  function parseNumber() {
    const t = consume();
    if (!/^\d/.test(t)) throw new Error('Expected number');
    return parseFloat(t);
  }

  function parseTerm() {
    let val = parseNumber();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseNumber();
      if (op === '*') val *= right;
      else { if (right === 0) throw new Error('Division by zero'); val /= right; }
    }
    return val;
  }

  function parseExpr() {
    let val = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      if (op === '+') val += right;
      else val -= right;
    }
    return val;
  }

  const result = parseExpr();
  if (pos !== tokens.length) throw new Error('Invalid expression');
  return result;
}

/* ── Calculator ───────────────────────────────────────────────────── */
function buildCalculator(body) {
  body.innerHTML = `
    <div class="app-calculator">
      <div class="calc-display">
        <div class="calc-expr"  id="calc-expr"></div>
        <div class="calc-result" id="calc-result">0</div>
      </div>
      <div class="calc-grid">
        <button class="calc-btn clear wide" data-action="clear">C</button>
        <button class="calc-btn op"         data-action="back">⌫</button>
        <button class="calc-btn op"         data-op="/">÷</button>
        <button class="calc-btn num"        data-num="7">7</button>
        <button class="calc-btn num"        data-num="8">8</button>
        <button class="calc-btn num"        data-num="9">9</button>
        <button class="calc-btn op"         data-op="*">×</button>
        <button class="calc-btn num"        data-num="4">4</button>
        <button class="calc-btn num"        data-num="5">5</button>
        <button class="calc-btn num"        data-num="6">6</button>
        <button class="calc-btn op"         data-op="-">−</button>
        <button class="calc-btn num"        data-num="1">1</button>
        <button class="calc-btn num"        data-num="2">2</button>
        <button class="calc-btn num"        data-num="3">3</button>
        <button class="calc-btn op"         data-op="+">+</button>
        <button class="calc-btn op"         data-action="sign">±</button>
        <button class="calc-btn num"        data-num="0">0</button>
        <button class="calc-btn op"         data-action="dot">.</button>
        <button class="calc-btn eq"         data-action="eq">=</button>
      </div>
    </div>`;

  let expr   = '';
  let result = '0';
  let newNum = true;

  const exprEl   = body.querySelector('#calc-expr');
  const resultEl = body.querySelector('#calc-result');

  function display(r) {
    result = String(r);
    resultEl.textContent = result;
  }

  body.querySelectorAll('.calc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const num    = btn.dataset.num;
      const op     = btn.dataset.op;
      const action = btn.dataset.action;

      if (num !== undefined) {
        if (newNum) { expr += num; newNum = false; }
        else        { expr += num; }
        display(expr.replace(/[+\-*/]/g, '').split(/[+\-*/]/).pop() || '0');
      } else if (op) {
        if (!expr && result !== '0') expr = result;
        expr += op;
        exprEl.textContent = expr;
        newNum = false;
      } else if (action === 'clear') {
        expr = ''; display('0'); exprEl.textContent = ''; newNum = true;
      } else if (action === 'back') {
        expr = expr.slice(0, -1);
        display(expr || '0');
      } else if (action === 'dot') {
        const parts = expr.split(/[+\-*/]/);
        if (!parts[parts.length - 1].includes('.')) {
          expr += expr ? '.' : '0.';
          display(expr.split(/[+\-*/]/).pop());
        }
      } else if (action === 'sign') {
        if (result !== '0') display(result.startsWith('-') ? result.slice(1) : '-' + result);
      } else if (action === 'eq') {
        if (!expr) return;
        try {
          const res = safeCalc(expr);
          exprEl.textContent = expr + ' =';
          expr = String(isFinite(res) ? res : 'Error');
          display(expr);
          newNum = true;
        } catch {
          display('Error');
          expr = '';
          newNum = true;
        }
      }
    });
  });
}

/* ── Settings ─────────────────────────────────────────────────────── */
function buildSettings(body) {
  body.innerHTML = `
    <div class="app-settings">
      <ul class="settings-sidebar">
        <li data-sec="appearance" class="active">🎨 Appearance</li>
        <li data-sec="system"    >⚙️  System</li>
        <li data-sec="about"     >ℹ️  About</li>
      </ul>
      <div class="settings-content">

        <div class="settings-section active" id="sec-appearance">
          <h2>Appearance</h2>
          <div class="setting-row">
            <label>Accent colour</label>
            <input type="color" id="st-accent" value="#7b2fff" />
          </div>
          <div class="setting-row">
            <label>UI scale</label>
            <input type="range" id="st-scale" min="80" max="130" value="100" />
          </div>
          <div class="setting-row">
            <label>Font</label>
            <select id="st-font">
              <option>Segoe UI</option>
              <option>Arial</option>
              <option>Georgia</option>
              <option>Courier New</option>
            </select>
          </div>
        </div>

        <div class="settings-section" id="sec-system">
          <h2>System</h2>
          <div class="setting-row">
            <label>Platform</label><span>Web (Browser)</span>
          </div>
          <div class="setting-row">
            <label>Version</label><span>Nightmare Desktop OS 1.0.0</span>
          </div>
          <div class="setting-row">
            <label>Window Manager</label><span>NDO-WM 1.0</span>
          </div>
        </div>

        <div class="settings-section" id="sec-about">
          <h2>About</h2>
          <p class="about-info">
            <strong>Nightmare Desktop OS</strong> is a browser-based desktop environment.<br/>
            It features a window manager, taskbar, start menu, and several built-in applications.<br/><br/>
            <strong>Built-in apps:</strong> Mozilla Firefox, File Manager, Text Editor, Terminal, Calculator, Settings.<br/><br/>
            <strong>Version:</strong> 1.0.0<br/>
            <strong>Engine:</strong> HTML5 / CSS3 / JavaScript (no frameworks)
          </p>
        </div>

      </div>
    </div>`;

  // Sidebar navigation
  body.querySelectorAll('.settings-sidebar li').forEach(li => {
    li.addEventListener('click', () => {
      body.querySelectorAll('.settings-sidebar li').forEach(l => l.classList.remove('active'));
      body.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
      li.classList.add('active');
      body.querySelector('#sec-' + li.dataset.sec).classList.add('active');
    });
  });

  // Accent colour
  body.querySelector('#st-accent').addEventListener('input', e => {
    document.documentElement.style.setProperty('--accent', e.target.value);
  });

  // Scale
  body.querySelector('#st-scale').addEventListener('input', e => {
    document.documentElement.style.fontSize = e.target.value + '%';
  });

  // Font
  body.querySelector('#st-font').addEventListener('change', e => {
    document.body.style.fontFamily = e.target.value + ', system-ui, sans-serif';
  });
}
