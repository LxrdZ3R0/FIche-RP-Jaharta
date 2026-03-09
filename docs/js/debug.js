/* ═══════════════════════════════════════════════════════════════
   JAHARTA DEBUG LOGGER — capture automatique des erreurs
   Inclure dans chaque page : <script src="js/debug.js"></script>
   ═══════════════════════════════════════════════════════════════ */

(function () {
  const STORAGE_KEY = 'jaharta_errors';
  const MAX_LOGS    = 80;

  /* ── Helpers ── */
  function timestamp() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }
  function currentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }
  function save(logs) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(-MAX_LOGS))); }
    catch {}
  }

  function push(type, message, detail) {
    const logs = load();
    logs.push({
      t:    timestamp(),
      page: currentPage(),
      type,
      msg:  String(message).slice(0, 300),
      detail: detail ? String(detail).slice(0, 600) : undefined,
    });
    save(logs);
    refreshPanel();
  }

  /* ── Intercepteurs globaux ── */
  window.addEventListener('error', function (e) {
    push('JS_ERROR', e.message, `${e.filename}:${e.lineno}:${e.colno}\n${e.error?.stack || ''}`);
  });

  window.addEventListener('unhandledrejection', function (e) {
    const msg = e.reason?.message || String(e.reason);
    push('PROMISE', msg, e.reason?.stack || '');
  });

  /* Patch console.error pour attraper les erreurs Firebase et autres */
  const _origError = console.error.bind(console);
  console.error = function (...args) {
    _origError(...args);
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    // Éviter les doublons avec les erreurs JS capturées ailleurs
    if (!msg.includes('ResizeObserver') && msg.length > 2) {
      push('CONSOLE_ERR', msg.slice(0, 300));
    }
  };

  /* ── Panneau flottant ── */
  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'jh-debug-panel';
    panel.style.cssText = `
      position:fixed; bottom:16px; right:16px; z-index:99999;
      font-family:'Share Tech Mono',monospace; font-size:11px;
      background:#04060f; border:1px solid rgba(0,245,255,.35);
      color:#c8e0f0; min-width:220px; max-width:380px;
      box-shadow:0 0 18px rgba(0,245,255,.12);
      clip-path:polygon(8px 0%,100% 0%,100% calc(100% - 8px),calc(100% - 8px) 100%,0% 100%,0% 8px);
    `;

    panel.innerHTML = `
      <div id="jh-debug-header" style="
        padding:7px 12px; display:flex; align-items:center; justify-content:space-between;
        border-bottom:1px solid rgba(0,245,255,.15); cursor:pointer;
        background:rgba(0,245,255,.04);
      ">
        <span>⚙ JAHARTA DEBUG</span>
        <span id="jh-debug-count" style="color:#ff006e; font-weight:bold"></span>
        <span id="jh-debug-toggle" style="color:#00f5ff; margin-left:8px;">▲</span>
      </div>
      <div id="jh-debug-body" style="padding:10px 12px 6px; display:none;">
        <div id="jh-debug-list" style="
          max-height:220px; overflow-y:auto; margin-bottom:8px;
          border:1px solid rgba(0,245,255,.1); padding:6px;
        "></div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button id="jh-debug-export" style="
            flex:1; background:rgba(0,245,255,.1); border:1px solid rgba(0,245,255,.3);
            color:#00f5ff; padding:5px; cursor:pointer; font-family:inherit; font-size:10px;
          ">⬇ Exporter .txt</button>
          <button id="jh-debug-clear" style="
            flex:1; background:rgba(255,0,110,.08); border:1px solid rgba(255,0,110,.3);
            color:#ff006e; padding:5px; cursor:pointer; font-family:inherit; font-size:10px;
          ">✕ Vider</button>
        </div>
        <div style="margin-top:6px; color:#5a7a90; font-size:10px; letter-spacing:.05em;">
          Page actuelle : <span style="color:#c8e0f0" id="jh-debug-page"></span>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    /* Toggle open/close */
    document.getElementById('jh-debug-header').addEventListener('click', () => {
      const body   = document.getElementById('jh-debug-body');
      const toggle = document.getElementById('jh-debug-toggle');
      const open   = body.style.display === 'none';
      body.style.display   = open ? 'block' : 'none';
      toggle.textContent   = open ? '▼' : '▲';
    });

    /* Export */
    document.getElementById('jh-debug-export').addEventListener('click', exportLogs);

    /* Clear */
    document.getElementById('jh-debug-clear').addEventListener('click', () => {
      if (confirm('Vider tous les logs ?')) {
        localStorage.removeItem(STORAGE_KEY);
        refreshPanel();
      }
    });

    /* Page name */
    const pg = document.getElementById('jh-debug-page');
    if (pg) pg.textContent = currentPage();
  }

  function refreshPanel() {
    const list  = document.getElementById('jh-debug-list');
    const count = document.getElementById('jh-debug-count');
    if (!list) return;

    const logs = load();
    count.textContent = logs.length > 0 ? `${logs.length} erreur${logs.length > 1 ? 's' : ''}` : '';
    count.style.color = logs.length > 0 ? '#ff006e' : '#00ff88';

    if (logs.length === 0) {
      list.innerHTML = '<span style="color:#5a7a90">Aucune erreur ✓</span>';
      return;
    }

    list.innerHTML = [...logs].reverse().map(e => {
      const typeColor = {
        JS_ERROR:    '#ff006e',
        PROMISE:     '#ffd60a',
        CONSOLE_ERR: '#e040fb',
      }[e.type] || '#00f5ff';

      return `<div style="margin-bottom:6px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,.05);">
        <span style="color:${typeColor}">[${e.type}]</span>
        <span style="color:#5a7a90"> ${e.t} · ${e.page}</span><br>
        <span style="color:#c8e0f0; word-break:break-word">${e.msg}</span>
        ${e.detail ? `<div style="color:#5a7a90; font-size:10px; margin-top:2px; word-break:break-word">${e.detail.slice(0, 120)}...</div>` : ''}
      </div>`;
    }).join('');
  }

  function exportLogs() {
    const logs = load();
    if (logs.length === 0) { alert('Aucune erreur à exporter.'); return; }

    const lines = [
      '═══════════════════════════════════════════',
      '  JAHARTA RP — Rapport d\'erreurs',
      `  Exporté le : ${timestamp()}`,
      `  Navigateur : ${navigator.userAgent.slice(0, 80)}`,
      '═══════════════════════════════════════════',
      '',
      ...logs.map((e, i) => [
        `[${i + 1}] ${e.type} — ${e.t}`,
        `    Page    : ${e.page}`,
        `    Message : ${e.msg}`,
        e.detail ? `    Détail  : ${e.detail}` : null,
        '',
      ].filter(Boolean).join('\n')),
      '═══════════════════════════════════════════',
      `Total : ${logs.length} erreur(s)`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `jaharta-errors-${timestamp().replace(/[: ]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── Init au chargement du DOM ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildPanel);
  } else {
    buildPanel();
  }

  /* ── API globale (utilisable depuis la console) ── */
  window.jaharataDebug = {
    logs:   load,
    export: exportLogs,
    clear:  () => { localStorage.removeItem(STORAGE_KEY); refreshPanel(); },
  };

})();
