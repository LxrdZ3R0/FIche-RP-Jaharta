/* ═══════════════════════════════════════════════════════════════════════
   docs/js/auth-badge.js — Badge admin partagé
   ═══════════════════════════════════════════════════════════════════════
   À inclure dans TOUTES les pages (sauf admin.html qui gère son propre auth).

     <script type="module" src="js/auth-badge.js"></script>

   Ce fichier :
   - Réutilise l'instance Firebase [DEFAULT] si elle existe déjà (cas fiches/pnj)
   - Sinon en crée une nouvelle (cas index, portail, racesjouables)
   - Écoute l'état de connexion et met à jour le badge + le lien nav admin

   Éléments HTML requis dans le nav :
     <a id="admin-badge" class="admin-badge" href="admin.html">ADMIN</a>
     <a class="nav-admin" href="admin.html">⚙ Connexion</a>
   ═══════════════════════════════════════════════════════════════════════ */

import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const cfg = {
  apiKey:            "AIzaSyAru7qZX8Gu_b8Y3oNDV-a5PmkrrkRjkcs",
  authDomain:        "jaharta-rp.firebaseapp.com",
  projectId:         "jaharta-rp",
  storageBucket:     "jaharta-rp.firebasestorage.app",
  messagingSenderId: "217075417489",
  appId:             "1:217075417489:web:4d1e2df422a5cd42411a30",
};

/* Réutilise l'app DEFAULT si déjà initialisée (fiches, pnj),
   sinon en crée une nouvelle (index, portail, racesjouables) */
const app  = getApps().length ? getApps()[0] : initializeApp(cfg);
const auth = getAuth(app);

onAuthStateChanged(auth, user => {

  /* ── État admin global ── */
  window._isAdmin = !!user;

  /* ── Badge vert "ADMIN" dans le nav ── */
  const badge = document.getElementById('admin-badge');
  if (badge) badge.classList.toggle('visible', !!user);

  /* ── Lien "⚙ Connexion" / "⚙ Connecté" ── */
  const navLink = document.querySelector('.nav-admin');
  if (navLink) {
    if (user) {
      navLink.textContent = '⚙ Connecté';
      navLink.removeAttribute('href');
      navLink.style.cursor  = 'default';
      navLink.style.opacity = '0.55';
    } else {
      navLink.textContent = '⚙ Connexion';
      navLink.setAttribute('href', 'admin.html');
      navLink.style.cursor  = '';
      navLink.style.opacity = '';
    }
  }

  /* ── Bouton "+ Ajouter une fiche" (fiches.html) ── */
  const addBtn = document.getElementById('add-char-btn');
  if (addBtn) addBtn.style.display = user ? 'inline-flex' : 'none';

  /* ── Dispatch un event custom pour les scripts non-module ──
     Permet à n'importe quelle page d'écouter : 
     document.addEventListener('jaharta:auth', e => { if(e.detail.user) ... }) */
  document.dispatchEvent(new CustomEvent('jaharta:auth', { detail: { user } }));
});
