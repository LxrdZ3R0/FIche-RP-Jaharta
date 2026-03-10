/* ═══════════════════════════════════════════════════════════════════════
   JAHARTA DEBUG LOGGER — docs/js/debug.js
   ═══════════════════════════════════════════════════════════════════════
   Logger d'erreurs flottant, actif sur toutes les pages en développement.

   FONCTIONNEMENT :
   - Capture automatiquement les erreurs JS (window.onerror),
     les promesses rejetées (unhandledrejection) et console.error
   - Stocke les logs dans localStorage (clé: jaharta_errors, max 80)
   - Affiche un panneau flottant en bas à droite avec compteur rouge
   - Bouton "Exporter .txt" pour partager les erreurs
   - Bouton "Vider" pour remettre à zéro

   UTILISATION dans le HTML :
     <script src="js/debug.js"></script>

   API GLOBALE (console du navigateur) :
     window.jaharataDebug.logs()    → tableau des logs
     window.jaharataDebug.export()  → télécharge le fichier .txt
     window.jaharataDebug.clear()   → vide les logs

   NOTE : Ce script est non-module (pas d'import/export) pour fonctionner
   sur toutes les pages sans conflit avec les modules Firebase.
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── Configuration ─── */
  const STORAGE_KEY = 'jaharta_errors';
  const MAX_LOGS    = 80; // nombre max d'entrées conservées

  /* ─── Utilitaires ─── */

  /** Retourne la date/heure courante en format lisible */
  function timestamp() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19);
  }

  /** Retourne le nom de la page courante */
  function currentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  /** Charge les logs depuis localStorage */
  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  /** Sauvegarde les logs dans localStorage (garde les MAX_LOGS derniers) */
  function save(logs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(-MAX_LOGS)));
    } catch {
      /* localStorage peut être indisponible (mode privé, quota dépassé) */
    }
  }

  /** Ajoute une entrée de log et rafraîchit le panneau */
  function push(type, message, detail) {
    const logs = load();
    logs.push({
      t:      timestamp(),
      page:   currentPage(),
      type,
      msg:    String(message).slice(0, 300),
      detail: detail ? String(detail).slice(0, 600) : undefined,
    });
    save(logs);
    refreshPanel();
  }

  /* ─── Intercepteurs d'erreurs globaux ─── */

  /** Capture les erreurs JS synchrones (TypeError, ReferenceError, etc.) */
  window.addEventListener('error', function (e) {
    push('JS_ERROR', e.message, `${e.filename}:${e.lineno}:${e.colno}\n${e.error?.stack || ''}`);
  });

  /** Capture les promesses rejetées non gérées (Firebase async, etc.) */
  window.addEventListener('unhandledrejection', function (e) {
    const msg = e.reason?.message || String(e.reason);
    push('PROMISE', msg, e.reason?.stack || '');
  });

  /**
   * Patch de console.error pour capturer les erreurs Firebase et autres.
   * On conserve le comportement original en appelant _origError.
   */
  const _origError = console.error.bind(console);
  console.error = function (...args) {
    _origError(...args);
    const msg = args
      .map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ');
    // Évite les doublons et les erreurs non pertinentes (ResizeObserver)
    if (!msg.includes('ResizeObserver') && msg.length > 2) {
      push('CONSOLE_ERR', msg.slice(0, 300));
    }
  };

  /* ─── Construction du panneau flottant ─── */

  /** Crée le panneau debug et l'insère dans le body */
  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'jh-debug-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 99999;
      font-family: 'Share Tech Mono', monospace;
      font-size: 11px;
      background: #04060f;
      border: 1px solid rgba(0,245,255,.35);
      color: #c8e0f0;
      min-width: 220px;
      max-width: 380px;
      box-shadow: 0 0 18px rgba(0,245,255,.12);
      clip-path: polygon(8px 0%,100% 0%,100% calc(100% - 8px),calc(100% - 8px) 100%,0% 100%,0% 8px);
    `;

    panel.innerHTML = `
      <!-- En-tête cliquable — toggle ouverture/fermeture -->
      <div id="jh-debug-header" style="
        padding: 7px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(0,245,255,.15);
        cursor: pointer;
        background: rgba(0,245,255,.04);
      ">
        <span>⚙ JAHARTA DEBUG</span>
        <span id="jh-debug-count" style="color:#ff006e; font-weight:bold"></span>
        <span id="jh-debug-toggle" style="color:#00f5ff; margin-left:8px;">▲</span>
      </div>

      <!-- Corps du panneau (caché par défaut) -->
      <div id="jh-debug-body" style="padding:10px 12px 6px; display:none;">

        <!-- Liste des erreurs -->
        <div id="jh-debug-list" style="
          max-height: 220px;
          overflow-y: auto;
          margin-bottom: 8px;
          border: 1px solid rgba(0,245,255,.1);
          padding: 6px;
        "></div>

        <!-- Boutons d'action -->
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button id="jh-debug-export" style="
            flex:1; background:rgba(0,245,255,.1);
            border:1px solid rgba(0,245,255,.3);
            color:#00f5ff; padding:5px; cursor:pointer;
            font-family:inherit; font-size:10px;
          ">⬇ Exporter .txt</button>

          <button id="jh-debug-clear" style="
            flex:1; background:rgba(255,0,110,.08);
            border:1px solid rgba(255,0,110,.3);
            color:#ff006e; padding:5px; cursor:pointer;
            font-family:inherit; font-size:10px;
          ">✕ Vider</button>
        </div>

        <!-- Page actuelle -->
        <div style="margin-top:6px; color:#5a7a90; font-size:10px; letter-spacing:.05em;">
          Page : <span style="color:#c8e0f0" id="jh-debug-page"></span>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    /* Toggle open/close au clic sur l'en-tête */
    document.getElementById('jh-debug-header').addEventListener('click', () => {
      const body   = document.getElementById('jh-debug-body');
      const toggle = document.getElementById('jh-debug-toggle');
      const isOpen = body.style.display === 'none';
      body.style.display   = isOpen ? 'block' : 'none';
      toggle.textContent   = isOpen ? '▼' : '▲';
    });

    /* Bouton export */
    document.getElementById('jh-debug-export').addEventListener('click', exportLogs);

    /* Bouton vider */
    document.getElementById('jh-debug-clear').addEventListener('click', () => {
      if (confirm('Vider tous les logs ?')) {
        localStorage.removeItem(STORAGE_KEY);
        refreshPanel();
      }
    });

    /* Affiche la page courante */
    const pg = document.getElementById('jh-debug-page');
    if (pg) pg.textContent = currentPage();
  }

  /** Met à jour le contenu du panneau (liste + compteur) */
  function refreshPanel() {
    const list  = document.getElementById('jh-debug-list');
    const count = document.getElementById('jh-debug-count');
    if (!list) return;

    const logs = load();
    const n = logs.length;

    /* Compteur coloré */
    count.textContent = n > 0 ? `${n} erreur${n > 1 ? 's' : ''}` : '';
    count.style.color = n > 0 ? '#ff006e' : '#00ff88';

    if (n === 0) {
      list.innerHTML = '<span style="color:#5a7a90">Aucune erreur ✓</span>';
      return;
    }

    /* Couleurs par type d'erreur */
    const typeColors = {
      JS_ERROR:    '#ff006e',
      PROMISE:     '#ffd60a',
      CONSOLE_ERR: '#e040fb',
    };

    /* Affiche les logs du plus récent au plus ancien */
    list.innerHTML = [...logs].reverse().map(e => {
      const color = typeColors[e.type] || '#00f5ff';
      return `
        <div style="margin-bottom:6px; padding-bottom:6px; border-bottom:1px solid rgba(255,255,255,.05);">
          <span style="color:${color}">[${e.type}]</span>
          <span style="color:#5a7a90"> ${e.t} · ${e.page}</span><br>
          <span style="color:#c8e0f0; word-break:break-word">${e.msg}</span>
          ${e.detail
            ? `<div style="color:#5a7a90; font-size:10px; margin-top:2px; word-break:break-word">
                 ${e.detail.slice(0, 120)}...
               </div>`
            : ''}
        </div>
      `;
    }).join('');
  }

  /** Télécharge un fichier .txt avec tous les logs */
  function exportLogs() {
    const logs = load();
    if (logs.length === 0) {
      alert('Aucune erreur à exporter.');
      return;
    }

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

    const blob     = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = `jaharta-errors-${timestamp().replace(/[: ]/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ─── Initialisation ─── */

  /* Attend le DOM si nécessaire (le script peut être en <head>) */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildPanel);
  } else {
    buildPanel();
  }

  /* ─── API publique ─── */
  window.jaharataDebug = {
    logs:   load,
    export: exportLogs,
    clear:  () => { localStorage.removeItem(STORAGE_KEY); refreshPanel(); },
  };

})();
