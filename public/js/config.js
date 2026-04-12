'use strict';

// ============================================================
//  KONSTANTEN
// ============================================================

const SIEB_OPTIONS = [
  'Einfachsieb 7 g',
  'Einfachsieb 14 g',
  'Doppelsieb 14 g',
  'Doppelsieb 16 g',
  'Doppelsieb 18 g',
  'Doppelsieb 20 g',
  'Doppelsieb 22 g',
  'VST 15 g',
  'VST 18 g',
  'VST 20 g',
  'Pressfilter',
  'AeroPress',
  'Herdkanne (Moka)',
  'French Press',
  'Handfilter / V60',
  'Chemex',
];

const ANWENDUNG_OPTIONS = [
  'Espresso',
  'Milchgetränke',
  'Lungo',
  'Americano',
  'Filter',
];

const TAG_CLASS = {
  Espresso:        'espresso',
  'Milchgetränke': 'milk',
  Lungo:           'lungo',
  Americano:       'americano',
  Filter:          'filter',
};

// ============================================================
//  STATE
// ============================================================

const state = {
  recipes:         [],
  view:            'list',   // 'list' | 'detail' | 'form'
  activeId:        null,
  editingId:       null,     // null = neues Rezept
  searchQuery:     '',
  searchVisible:   false,
  loading:         false,
  deleteConfirmId: null,
  _toastTimer:     null,
};

// ============================================================
//  API  →  api.php
// ============================================================

const api = {
  async getAll() {
    const res = await fetch('api.php');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async create(data) {
    const res = await fetch('api.php', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async update(id, data) {
    const res = await fetch(`api.php?id=${encodeURIComponent(id)}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async remove(id) {
    const res = await fetch(`api.php?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(await res.text());
  },
};

// ============================================================
//  HILFSFUNKTIONEN
// ============================================================

/** HTML-Sonderzeichen escapen */
function h(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Brühverhältnis berechnen → "1 : 2.0" */
function calcRatio(kaffeemenge, bruehmenge) {
  const k = parseFloat(kaffeemenge);
  const b = parseFloat(bruehmenge);
  if (!k || !b || k <= 0) return null;
  return `1\u2009:\u2009${(b / k).toFixed(1)}`;
}

/** Sekunden formatieren → "28 sek" / "1:05 min" */
function fmtSec(val) {
  const n = parseInt(val, 10);
  if (!val || isNaN(n)) return '—';
  if (n < 60) return `${n} sek`;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return s > 0 ? `${m}:${String(s).padStart(2, '0')} min` : `${m} min`;
}

/** Zahl mit optionaler Einheit formatieren */
function fmtNum(val, unit = '') {
  if (val == null || val === '') return '—';
  return unit ? `${val}\u202F${unit}` : String(val);
}

/** Gefilterte Rezeptliste anhand Suchbegriff */
function filteredRecipes() {
  const q = state.searchQuery.toLowerCase().trim();
  if (!q) return state.recipes;
  return state.recipes.filter(r =>
    (r.marke || '').toLowerCase().includes(q) ||
    (r.name  || '').toLowerCase().includes(q)
  );
}

// ============================================================
//  TOAST
// ============================================================

function showToast(msg, type = 'success') {
  if (state._toastTimer) clearTimeout(state._toastTimer);
  document.getElementById('toast')?.remove();

  const icon = type === 'success' ? 'check-circle-2' : 'alert-circle';
  const el   = document.createElement('div');
  el.id        = 'toast';
  el.className = `toast toast--${type}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `<i data-lucide="${icon}"></i><span>${h(msg)}</span>`;
  document.body.appendChild(el);
  lucide.createIcons({ nodes: [el] });

  requestAnimationFrame(() => el.classList.add('toast--visible'));
  state._toastTimer = setTimeout(() => {
    el.classList.remove('toast--visible');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}
