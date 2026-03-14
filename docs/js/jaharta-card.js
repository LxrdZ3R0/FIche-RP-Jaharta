/* ═══════════════════════════════════════════════════════════════════════
   docs/js/jaharta-card.js — Web Component <jaharta-card>
   ═══════════════════════════════════════════════════════════════════════
   Encapsule toute la logique de rendu d'une carte personnage.
   Avant : buildCard(ch) construisait ~80 lignes de DOM à la main.
   Après : une seule ligne — el.fiche = data — et la carte apparaît.

   UTILISATION dans fiches.html (module ESM) :
     import '/js/jaharta-card.js';              // enregistre le custom element
     const el = document.createElement('jaharta-card');
     el.fiche = { id, firstname, lastname, race, rank, stats, ... };
     container.appendChild(el);

   DESIGN — Light DOM (pas de Shadow DOM) :
     Le composant rend ses enfants directement dans le DOM principal.
     Avantages :
       · Hérite automatiquement de jaharta.css (pas de duplication CSS)
       · Les CSS variables (--cyan, --gold…) fonctionnent sans config
       · Pas de flash de contenu non stylé
     Inconvénients acceptés :
       · Moins d'encapsulation (ok pour ce projet mono-équipe)

   DÉPENDANCES (chargées AVANT ce fichier via <script src>) :
     window.RACES          → constants.js
     window.RANKS          → constants.js
     window.sanitize()     → utils.js
     window._isAdmin       → module Firebase fiches.html
     window.openEditFiche  → module Firebase fiches.html
     window.deleteFicheById→ module Firebase fiches.html
   ═══════════════════════════════════════════════════════════════════════ */

class JahartaCard extends HTMLElement {

  constructor() {
    super();
    /* display:contents = l'élément est transparent pour le layout.
       Sa div enfante .rp-card participe directement à la CSS grid. */
    this.style.display = 'contents';
    this._data = null;
  }

  /* ── API publique : assigner les données déclenche le rendu ── */
  set fiche(data) {
    this._data = data;
    /* Ne rendre que si l'élément est dans le DOM (connectedCallback) */
    if (this.isConnected) this._render();
  }

  get fiche() {
    return this._data;
  }

  /* ── Cycle de vie : appelé quand l'élément est inséré dans le DOM ── */
  connectedCallback() {
    if (this._data) this._render();
  }

  /* ════════════════════════════════════════════════════════════════════
     RENDER — Construit tout le DOM de la carte
     ════════════════════════════════════════════════════════════════════ */
  _render() {
    const ch = this._data;

    /* Accès aux données globales (chargées par constants.js) */
    const RACES = window.RACES || {};
    const RANKS = window.RANKS || {};
    const san   = window.sanitize || (s => String(s || '').trim().slice(0, 2000));

    const rc = RACES[ch.race] || { color: '#00c8ff', label: ch.race || '?' };
    const rk = RANKS[ch.rank] || RANKS.F || { color: '#6b7280' };

    /* ── Racine : div.rp-card (styles dans jaharta.css) ── */
    const card = document.createElement('div');
    card.className    = 'rp-card';
    card.dataset.race   = ch.race  || '';  /* pour filterRace() */
    card.dataset.rank   = ch.rank  || '';  /* pour filterRank() */

    /* ──────────────────────────────
       PHOTO + éléments superposés
       ────────────────────────────── */
    const photo = document.createElement('div');
    photo.className = 'card-photo';

    /* Bande colorée (race) */
    const stripe = document.createElement('div');
    stripe.className = 'card-stripe';
    stripe.style.background = `linear-gradient(90deg,${rc.color},${rc.color}20)`;
    photo.appendChild(stripe);

    /* Image ou placeholder initiales */
    if (ch.photoUrl || ch.photo) {
      const img    = document.createElement('img');
      img.src      = ch.photoUrl || ch.photo;
      img.alt      = ch.firstname || '';
      img.loading  = 'lazy';
      img.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;' +
        'object-fit:cover;object-position:top center;z-index:1;';
      img.onerror = () => img.remove();
      photo.appendChild(img);
    } else {
      const ph      = document.createElement('div');
      ph.className  = 'card-photo-ph';
      ph.style.color = rc.color;
      ph.textContent = (ch.firstname?.[0] || '') + (ch.lastname?.[0] || '');
      photo.appendChild(ph);
    }

    /* Overlay dégradé bas */
    const ov = document.createElement('div');
    ov.className = 'card-photo-ov';
    photo.appendChild(ov);

    /* ── Badge Rang (haut-droite) ── */
    const badge = document.createElement('div');
    badge.className = 'rank-badge';
    badge.style.color = rk.color;

    const bv = document.createElement('div');
    bv.className = 'rb-val' + (ch.rank === 'SSS' ? ' sm' : '');
    /* Animation pulsante pour les rangs élevés */
    if (['SSS','X','T','G','G+','Z'].includes(ch.rank)) {
      bv.style.animation = 'rankPulse 2.5s infinite';
    }
    bv.textContent = ch.rank || '?';

    const bl = document.createElement('div');
    bl.className  = 'rb-lbl';
    bl.textContent = 'RANG';

    badge.appendChild(bv);
    badge.appendChild(bl);
    photo.appendChild(badge);

    /* ── Barre de stats (bas de photo, cachée si tout à 0) ── */
    const statDefs = [
      { k: 'str',  lbl: 'STR',  cls: 'sb-str'  },
      { k: 'agi',  lbl: 'AGI',  cls: 'sb-agi'  },
      { k: 'spd',  lbl: 'SPD',  cls: 'sb-spd'  },
      { k: 'int',  lbl: 'INT',  cls: 'sb-int'  },
      { k: 'mana', lbl: 'MNA',  cls: 'sb-mana' },
      { k: 'res',  lbl: 'RES',  cls: 'sb-res'  },
      { k: 'cha',  lbl: 'CHA',  cls: 'sb-cha'  },
      { k: 'aura', lbl: 'AUR',  cls: 'sb-aura' },
    ];

    const s        = ch.stats || {};
    const hasStats = statDefs.some(d => (s[d.k] || 0) > 0);

    if (hasStats) {
      const bar = document.createElement('div');
      bar.className = 'stats-bar';

      statDefs.forEach(d => {
        const v = s[d.k] || 0;
        /* Cacher AURA si valeur nulle */
        if (d.k === 'aura' && v === 0) return;

        const item  = document.createElement('div');
        item.className = `sb-item ${d.cls}`;

        const lbl   = document.createElement('div');
        lbl.className = 'sb-lbl';
        lbl.textContent = d.lbl;

        const val   = document.createElement('div');
        val.className = 'sb-val';
        val.textContent = v;

        const barEl = document.createElement('div');
        barEl.className = 'sb-bar';

        const fill  = document.createElement('div');
        fill.className = 'sb-fill';
        fill.style.width = Math.min(100, Math.round(v / 9999 * 100)) + '%';

        barEl.appendChild(fill);
        item.appendChild(lbl);
        item.appendChild(val);
        item.appendChild(barEl);
        bar.appendChild(item);
      });

      if (bar.children.length > 0) photo.appendChild(bar);
    }

    card.appendChild(photo);

    /* ──────────────────────────────
       CORPS DE CARTE
       ────────────────────────────── */
    const body = document.createElement('div');
    body.className = 'card-body';

    /* Prénom (petites capitales) */
    const fn = document.createElement('div');
    fn.className  = 'card-fn';
    fn.textContent = san(ch.firstname || '');
    body.appendChild(fn);

    /* Nom (grande typo) */
    const ln = document.createElement('div');
    ln.className  = 'card-ln';
    ln.textContent = san(ch.lastname || '');
    body.appendChild(ln);

    /* Âge — affiché si renseigné */
    if (ch.age) {
      const age = document.createElement('div');
      age.className   = 'card-age';
      age.textContent = ch.age;
      body.appendChild(age);
    }

    /* Pilule race · race spécifique */
    const pill = document.createElement('div');
    pill.className = 'card-rpill';
    pill.style.cssText =
      `color:${rc.color};border-color:${rc.color}44;background:${rc.color}0e;`;
    const raceLabel = ch.raceSpecific
      ? `${rc.label} <span style="opacity:.5;margin:0 3px">·</span>` +
        `<span style="opacity:.85">${ch.raceSpecific}</span>`
      : rc.label;
    pill.innerHTML =
      `<span class="rpip" style="background:${rc.color};box-shadow:0 0 4px ${rc.color}"></span>` +
      raceLabel;
    body.appendChild(pill);

    /* Description */
    const desc = document.createElement('p');
    desc.className  = 'card-desc';
    desc.textContent = san(ch.desc || ch.bio || '');
    body.appendChild(desc);

    /* ── Pouvoirs (si présents) ── */
    const powers = ch.powers || [];
    if (powers.length > 0) {
      const ps = document.createElement('div');
      ps.className = 'powers-section';

      const pt = document.createElement('div');
      pt.className  = 'powers-title';
      pt.textContent = '⚡ Pouvoirs';
      ps.appendChild(pt);

      const pl = document.createElement('div');
      pl.className = 'powers-list';

      powers.forEach(pw => {
        const pi = document.createElement('div');
        pi.className    = 'power-item';
        pi.style.borderColor = rc.color + '88';
        pi.style.background  = rc.color + '08';

        const pn = document.createElement('div');
        pn.className  = 'power-name';
        pn.style.color = rc.color;
        pn.textContent = pw.name || pw;
        pi.appendChild(pn);

        if (pw.desc) {
          const pd = document.createElement('div');
          pd.className  = 'power-desc';
          pd.textContent = pw.desc;
          pi.appendChild(pd);
        }
        pl.appendChild(pi);
      });

      ps.appendChild(pl);
      body.appendChild(ps);
    }

    /* ── Liens (fiche, fichier, etc.) ── */
    const links = document.createElement('div');
    links.className = 'card-links';

    const ls = ch.links || (ch.linkUrl ? [{ t: ch.linkType || 'Fiche', h: ch.linkUrl }] : []);
    ls.forEach(l => {
      const a     = document.createElement('a');
      a.className = 'lbtn';
      a.href      = l.h || l.url || '#';
      a.target    = '_blank';
      a.innerHTML =
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">` +
        `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>` +
        `<polyline points="14 2 14 8 20 8"/></svg>${l.t || l.type || 'Lien'}`;
      links.appendChild(a);
    });

    /* Bouton télécharger si fichier uploadé */
    if (ch.ficheFileUrl) {
      const a     = document.createElement('a');
      a.className = 'lbtn';
      a.href      = ch.ficheFileUrl;
      a.target    = '_blank';
      a.title     = ch.ficheFileName || 'Fiche';
      a.innerHTML =
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">` +
        `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>` +
        `<polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>` +
        `Télécharger`;
      links.appendChild(a);
    }

    body.appendChild(links);

    /* ── Boutons admin (Modifier / Supprimer) — affichés si connecté ── */
    if (ch.id) {
      const adminRow = document.createElement('div');
      adminRow.className = 'card-admin-row';
      /* Visibilité pilotée par window._isAdmin (mis à jour par le module Firebase) */
      adminRow.style.display = window._isAdmin ? 'flex' : 'none';

      const editBtn = document.createElement('button');
      editBtn.className  = 'card-edit-btn';
      editBtn.textContent = '✎ Modifier';
      editBtn.onclick    = () => window.openEditFiche?.(ch.id);

      const delBtn = document.createElement('button');
      delBtn.className  = 'card-del-btn';
      delBtn.textContent = '✕ Supprimer';
      delBtn.onclick    = () => window.deleteFicheById?.(ch.id);

      adminRow.appendChild(editBtn);
      adminRow.appendChild(delBtn);
      body.appendChild(adminRow);
    }

    card.appendChild(body);

    /* Décoration coin bas-gauche */
    const deco = document.createElement('div');
    deco.className = 'cdeco';
    card.appendChild(deco);

    /* ── Exposition des attributs de filtrage sur l'élément hôte ── */
    this.dataset.race = ch.race || '';
    this.dataset.rank = ch.rank || '';

    /* ── Insertion finale : remplace le contenu précédent ── */
    this.replaceChildren(card);
  }

  /* ── Met à jour la visibilité des boutons admin sans re-render complet ── */
  updateAdminVisibility(isAdmin) {
    const row = this.querySelector('.card-admin-row');
    if (row) row.style.display = isAdmin ? 'flex' : 'none';
  }
}

/* Enregistre le custom element <jaharta-card> */
customElements.define('jaharta-card', JahartaCard);
