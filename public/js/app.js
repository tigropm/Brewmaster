'use strict';

// ============================================================
//  CONSTANTS
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
  Espresso:      'espresso',
  'Milchgetränke': 'milk',
  Lungo:         'lungo',
  Americano:     'americano',
  Filter:        'filter',
};

// ============================================================
//  STATE
// ============================================================

const state = {
  recipes:          [],
  view:             'list',   // 'list' | 'detail' | 'form'
  activeId:         null,
  editingId:        null,     // null = new recipe
  searchQuery:      '',
  searchVisible:    false,
  loading:          false,
  deleteConfirmId:  null,
  _toastTimer:      null,
};

// ============================================================
//  HELPERS
// ============================================================

function h(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function calcRatio(kaffeemenge, bruehmenge) {
  const k = parseFloat(kaffeemenge);
  const b = parseFloat(bruehmenge);
  if (!k || !b || k <= 0) return null;
  return `1\u2009:\u2009${(b / k).toFixed(1)}`;
}

function fmtSec(val) {
  const n = parseInt(val, 10);
  if (!val || isNaN(n)) return '—';
  if (n < 60) return `${n} sek`;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return s > 0 ? `${m}:${String(s).padStart(2, '0')} min` : `${m} min`;
}

function fmtNum(val, unit = '') {
  if (val == null || val === '') return '—';
  return unit ? `${val}\u202F${unit}` : String(val);
}

function filteredRecipes() {
  const q = state.searchQuery.toLowerCase().trim();
  if (!q) return state.recipes;
  return state.recipes.filter(r =>
    (r.marke || '').toLowerCase().includes(q) ||
    (r.name  || '').toLowerCase().includes(q)
  );
}

// ============================================================
//  API
// ============================================================

const api = {
  async getAll() {
    const res = await fetch('/api/recipes');
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async create(data) {
    const res = await fetch('/api/recipes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async update(id, data) {
    const res = await fetch(`/api/recipes/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async remove(id) {
    const res = await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
  },
};

// ============================================================
//  TOAST
// ============================================================

function showToast(msg, type = 'success') {
  if (state._toastTimer) clearTimeout(state._toastTimer);
  document.getElementById('toast')?.remove();

  const icon = type === 'success' ? 'check-circle-2' : 'alert-circle';
  const el = document.createElement('div');
  el.id = 'toast';
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

// ============================================================
//  RENDER HELPERS
// ============================================================

function renderTags(anwendung = []) {
  if (!anwendung.length) return '';
  return anwendung
    .map(a => `<span class="tag tag--${TAG_CLASS[a] || 'default'}">${h(a)}</span>`)
    .join('');
}

function renderSiebOptions(selected = '') {
  return SIEB_OPTIONS
    .map(o => `<option value="${h(o)}"${selected === o ? ' selected' : ''}>${h(o)}</option>`)
    .join('');
}

// ============================================================
//  VIEW: LIST
// ============================================================

function renderListView() {
  const list = filteredRecipes();

  return /* html */`
    <div class="view view--list">
      <header class="header">
        <div class="header__brand">
          <i data-lucide="coffee"></i>
          <span>Brewmaster</span>
        </div>
        <div class="header__actions">
          <button class="icon-btn" id="btn-search-toggle"
            aria-label="Suche ein-/ausblenden"
            aria-expanded="${state.searchVisible}">
            <i data-lucide="${state.searchVisible ? 'x' : 'search'}"></i>
          </button>
          <button class="icon-btn icon-btn--primary" id="btn-add"
            aria-label="Neues Rezept hinzufügen">
            <i data-lucide="plus"></i>
          </button>
        </div>
      </header>

      ${state.searchVisible ? /* html */`
        <div class="search-bar">
          <label for="search-input" class="sr-only">Kaffee suchen</label>
          <div class="search-bar__inner">
            <i data-lucide="search" class="search-bar__icon"></i>
            <input
              type="search"
              id="search-input"
              class="search-bar__input"
              placeholder="Marke oder Name suchen…"
              value="${h(state.searchQuery)}"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
            >
            ${state.searchQuery ? `
              <button class="search-bar__clear" id="btn-search-clear"
                aria-label="Suche löschen">
                <i data-lucide="x"></i>
              </button>` : ''}
          </div>
        </div>
      ` : ''}

      <div class="list-content">
        ${state.loading
          ? renderSkeleton()
          : list.length === 0
            ? renderEmptyState()
            : /* html */`
              <ul class="recipe-list" role="list">
                ${list.map(renderCard).join('')}
              </ul>`
        }
      </div>
    </div>
  `;
}

function renderSkeleton() {
  return /* html */`
    <ul class="recipe-list" aria-busy="true" aria-label="Lade Rezepte…">
      ${[1,2,3].map(() => /* html */`
        <li>
          <div class="recipe-card recipe-card--skeleton" aria-hidden="true">
            <div class="recipe-card__header">
              <div class="recipe-card__title-group">
                <div class="skeleton skeleton--title"></div>
                <div class="skeleton skeleton--subtitle"></div>
              </div>
            </div>
            <div class="skeleton skeleton--tags"></div>
            <div class="skeleton skeleton--stats"></div>
          </div>
        </li>`).join('')}
    </ul>`;
}

function renderEmptyState() {
  if (state.searchQuery) {
    return /* html */`
      <div class="empty-state">
        <div class="empty-state__icon"><i data-lucide="search-x"></i></div>
        <p class="empty-state__title">Keine Ergebnisse</p>
        <p class="empty-state__text">
          Für „${h(state.searchQuery)}" wurden keine Rezepte gefunden.
        </p>
        <button class="btn btn--ghost" id="btn-clear-search">
          Suche zurücksetzen
        </button>
      </div>`;
  }
  return /* html */`
    <div class="empty-state">
      <div class="empty-state__icon"><i data-lucide="coffee"></i></div>
      <p class="empty-state__title">Noch keine Rezepte</p>
      <p class="empty-state__text">
        Füge dein erstes Brührezept hinzu, um Parameter für neue Kaffees festzuhalten.
      </p>
      <button class="btn btn--primary" id="btn-add-empty">
        <i data-lucide="plus"></i>
        Rezept hinzufügen
      </button>
    </div>`;
}

function renderCard(recipe) {
  const ratio = calcRatio(recipe.kaffeemenge, recipe.bruehmenge);
  const tags  = recipe.anwendung || [];

  const stats = [
    recipe.mahlgrad    != null ? { label: 'Mahlgrad', value: h(String(recipe.mahlgrad)) }        : null,
    recipe.kaffeemenge != null ? { label: 'Dosis',    value: `${h(String(recipe.kaffeemenge))} g` } : null,
    ratio               ? { label: 'Ratio',    value: h(ratio) }                                  : null,
    recipe.sieb         ? { label: 'Sieb',     value: h(recipe.sieb), truncate: true }            : null,
  ].filter(Boolean);

  return /* html */`
    <li>
      <button
        class="recipe-card"
        data-id="${h(recipe.id)}"
        aria-label="Rezept öffnen: ${h(recipe.marke)} ${h(recipe.name)}"
      >
        <div class="recipe-card__header">
          <div class="recipe-card__title-group">
            <span class="recipe-card__brand">${h(recipe.marke) || '—'}</span>
            <span class="recipe-card__name">${h(recipe.name)  || '—'}</span>
          </div>
          <i data-lucide="chevron-right" class="recipe-card__arrow"></i>
        </div>
        ${tags.length ? `<div class="recipe-card__tags">${renderTags(tags)}</div>` : ''}
        ${stats.length ? /* html */`
          <div class="recipe-card__stats">
            ${stats.map(s => /* html */`
              <div class="stat">
                <span class="stat__label">${s.label}</span>
                <span class="stat__value${s.truncate ? ' stat__value--truncate' : ''}">${s.value}</span>
              </div>`).join('')}
          </div>` : ''}
      </button>
    </li>`;
}

// ============================================================
//  VIEW: DETAIL
// ============================================================

function renderDetailView() {
  const r = state.recipes.find(x => x.id === state.activeId);
  if (!r) { navigate('list'); return ''; }

  const ratio = calcRatio(r.kaffeemenge, r.bruehmenge);

  return /* html */`
    <div class="view view--detail">
      <header class="header">
        <button class="icon-btn" id="btn-back" aria-label="Zurück zur Übersicht">
          <i data-lucide="arrow-left"></i>
        </button>
        <span class="sr-only header__title">Rezept</span>
        <div class="header__actions">
          <button class="icon-btn" id="btn-edit" aria-label="Rezept bearbeiten">
            <i data-lucide="pencil"></i>
          </button>
          <button class="icon-btn icon-btn--danger" id="btn-delete"
            data-id="${h(r.id)}" aria-label="Rezept löschen">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </header>

      <div class="detail-content">
        <div class="detail-hero">
          <p class="detail-hero__brand">${h(r.marke) || '—'}</p>
          <h1 class="detail-hero__name">${h(r.name) || '—'}</h1>
          ${(r.anwendung || []).length ? `
            <div class="detail-hero__tags">${renderTags(r.anwendung)}</div>` : ''}
        </div>

        <div class="detail-sections">

          ${r.sieb ? /* html */`
            <section class="detail-section" aria-label="Sieb">
              <h2 class="detail-section__title">
                <i data-lucide="circle"></i>Sieb
              </h2>
              <dl class="detail-grid">
                <div class="detail-row">
                  <dt>Sieb</dt>
                  <dd>${h(r.sieb)}</dd>
                </div>
              </dl>
            </section>` : ''}

          <section class="detail-section" aria-label="Mahlung">
            <h2 class="detail-section__title">
              <i data-lucide="settings-2"></i>Mahlung
            </h2>
            <dl class="detail-grid">
              <div class="detail-row">
                <dt>Mahlgrad</dt>
                <dd>${fmtNum(r.mahlgrad)}</dd>
              </div>
              <div class="detail-row">
                <dt>Mahlzeit</dt>
                <dd>${fmtSec(r.mahlzeit)}</dd>
              </div>
            </dl>
          </section>

          <section class="detail-section" aria-label="Extraktion">
            <h2 class="detail-section__title">
              <i data-lucide="droplets"></i>Extraktion
            </h2>
            <dl class="detail-grid">
              <div class="detail-row">
                <dt>Kaffeemenge</dt>
                <dd>${fmtNum(r.kaffeemenge, 'g')}</dd>
              </div>
              <div class="detail-row">
                <dt>Brühzeit</dt>
                <dd>${fmtSec(r.bruehzeit)}</dd>
              </div>
              <div class="detail-row">
                <dt>Brühmenge</dt>
                <dd>${fmtNum(r.bruehmenge, 'ml')}</dd>
              </div>
              ${ratio ? /* html */`
                <div class="detail-row detail-row--highlight">
                  <dt>Brühverhältnis</dt>
                  <dd>${h(ratio)}</dd>
                </div>` : ''}
            </dl>
          </section>

        </div>
      </div>
    </div>`;
}

// ============================================================
//  VIEW: FORM
// ============================================================

function renderFormView() {
  const r     = state.editingId ? state.recipes.find(x => x.id === state.editingId) : null;
  const v     = (f) => r && r[f] != null ? h(String(r[f])) : '';
  const chk   = (opt) => r && (r.anwendung || []).includes(opt);
  const title = state.editingId ? 'Rezept bearbeiten' : 'Neues Rezept';

  return /* html */`
    <div class="view view--form">
      <header class="header">
        <button class="icon-btn" id="btn-cancel" aria-label="Abbrechen">
          <i data-lucide="x"></i>
        </button>
        <span class="header__title">${h(title)}</span>
        <button class="btn btn--primary btn--sm" id="btn-save">
          Speichern
        </button>
      </header>

      <div class="form-content">
        <form id="recipe-form" novalidate aria-label="${h(title)}">

          <!-- Kaffee -->
          <fieldset class="form-section">
            <legend class="form-section__title">Kaffee</legend>

            <div class="form-group">
              <label class="form-label" for="f-marke">Marke</label>
              <input type="text" id="f-marke" name="marke"
                class="form-input" value="${v('marke')}"
                placeholder="z.&nbsp;B. Gardelli, Five Elephant…"
                autocomplete="off">
            </div>

            <div class="form-group">
              <label class="form-label required" for="f-name">Name des Kaffees</label>
              <input type="text" id="f-name" name="name"
                class="form-input" value="${v('name')}"
                placeholder="z.&nbsp;B. Ethiopia Guji Natural"
                required autocomplete="off">
            </div>
          </fieldset>

          <!-- Mahlung -->
          <fieldset class="form-section">
            <legend class="form-section__title">Mahlung</legend>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="f-mahlgrad">Mahlgrad</label>
                <input type="number" id="f-mahlgrad" name="mahlgrad"
                  class="form-input" value="${v('mahlgrad')}"
                  placeholder="z.&nbsp;B. 3.5"
                  step="0.5" min="0">
              </div>
              <div class="form-group">
                <label class="form-label" for="f-mahlzeit">Mahlzeit</label>
                <div class="input-unit-wrap">
                  <input type="number" id="f-mahlzeit" name="mahlzeit"
                    class="form-input" value="${v('mahlzeit')}"
                    placeholder="8"
                    step="1" min="0">
                  <span class="input-unit">sek</span>
                </div>
              </div>
            </div>
          </fieldset>

          <!-- Extraktion -->
          <fieldset class="form-section">
            <legend class="form-section__title">Extraktion</legend>

            <div class="form-group">
              <label class="form-label" for="f-sieb">Sieb</label>
              <div class="select-wrapper">
                <select id="f-sieb" name="sieb" class="form-select">
                  <option value="">Sieb auswählen…</option>
                  ${renderSiebOptions(r?.sieb || '')}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="f-kaffeemenge">Kaffeemenge</label>
                <div class="input-unit-wrap">
                  <input type="number" id="f-kaffeemenge" name="kaffeemenge"
                    class="form-input" value="${v('kaffeemenge')}"
                    placeholder="18"
                    step="0.1" min="0">
                  <span class="input-unit">g</span>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="f-bruehmenge">Brühmenge</label>
                <div class="input-unit-wrap">
                  <input type="number" id="f-bruehmenge" name="bruehmenge"
                    class="form-input" value="${v('bruehmenge')}"
                    placeholder="36"
                    step="1" min="0">
                  <span class="input-unit">ml</span>
                </div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="f-bruehzeit">Brühzeit</label>
              <div class="input-unit-wrap">
                <input type="number" id="f-bruehzeit" name="bruehzeit"
                  class="form-input" value="${v('bruehzeit')}"
                  placeholder="28"
                  step="1" min="0">
                <span class="input-unit">sek</span>
              </div>
            </div>

            <div class="ratio-preview" id="ratio-preview">
              ${r?.kaffeemenge && r?.bruehmenge ? /* html */`
                <span class="ratio-preview__label">Brühverhältnis</span>
                <span class="ratio-preview__value">
                  ${h(calcRatio(r.kaffeemenge, r.bruehmenge) || '—')}
                </span>` : ''}
            </div>
          </fieldset>

          <!-- Anwendung -->
          <fieldset class="form-section">
            <legend class="form-section__title">Anwendung</legend>
            <div class="checkbox-group"
              role="group" aria-label="Anwendung wählen (Mehrfachauswahl)">
              ${ANWENDUNG_OPTIONS.map(opt => /* html */`
                <label class="checkbox-pill">
                  <input type="checkbox" name="anwendung"
                    value="${h(opt)}"${chk(opt) ? ' checked' : ''}>
                  <span>${h(opt)}</span>
                </label>`).join('')}
            </div>
          </fieldset>

        </form>
      </div>
    </div>`;
}

// ============================================================
//  RENDER DIALOG
// ============================================================

function renderDeleteDialog() {
  return /* html */`
    <div class="dialog-overlay" id="delete-dialog"
      role="dialog" aria-modal="true" aria-labelledby="dlg-title">
      <div class="dialog">
        <div class="dialog__icon"><i data-lucide="trash-2"></i></div>
        <h2 class="dialog__title" id="dlg-title">Rezept löschen?</h2>
        <p class="dialog__text">
          Dieser Eintrag wird dauerhaft gelöscht.<br>Die Aktion kann nicht rückgängig gemacht werden.
        </p>
        <div class="dialog__actions">
          <button class="btn btn--ghost" id="btn-delete-cancel">Abbrechen</button>
          <button class="btn btn--danger" id="btn-delete-confirm"
            data-id="${h(state.deleteConfirmId)}">
            Löschen
          </button>
        </div>
      </div>
    </div>`;
}

// ============================================================
//  NAVIGATION & RE-RENDER
// ============================================================

function navigate(view, opts = {}) {
  state.view = view;
  if ('activeId'  in opts) state.activeId  = opts.activeId;
  if ('editingId' in opts) state.editingId = opts.editingId;
  repaint();
  window.scrollTo(0, 0);
}

function repaint() {
  const root = document.getElementById('app');

  let html = '';
  if (state.view === 'list')   html = renderListView();
  else if (state.view === 'detail') html = renderDetailView();
  else if (state.view === 'form')   html = renderFormView();

  if (state.deleteConfirmId) html += renderDeleteDialog();

  root.innerHTML = html;
  lucide.createIcons();
  bindEvents();
}

// ============================================================
//  EVENT BINDING
// ============================================================

function bindEvents() {
  const $ = id => document.getElementById(id);

  // ── List view ────────────────────────────────────────────

  $('btn-add')?.addEventListener('click', () => {
    state.editingId = null;
    navigate('form');
  });

  $('btn-add-empty')?.addEventListener('click', () => {
    state.editingId = null;
    navigate('form');
  });

  $('btn-search-toggle')?.addEventListener('click', () => {
    state.searchVisible = !state.searchVisible;
    if (!state.searchVisible) state.searchQuery = '';
    repaint();
    if (state.searchVisible) $('search-input')?.focus();
  });

  $('search-input')?.addEventListener('input', e => {
    state.searchQuery = e.target.value;
    repaint();
    // Keep focus in search input after repaint
    const inp = $('search-input');
    if (inp) {
      inp.focus();
      // restore cursor position
      const len = inp.value.length;
      inp.setSelectionRange(len, len);
    }
  });

  $('btn-search-clear')?.addEventListener('click', () => {
    state.searchQuery = '';
    repaint();
    $('search-input')?.focus();
  });

  $('btn-clear-search')?.addEventListener('click', () => {
    state.searchQuery   = '';
    state.searchVisible = false;
    repaint();
  });

  document.querySelectorAll('.recipe-card[data-id]').forEach(card => {
    card.addEventListener('click', () => {
      navigate('detail', { activeId: card.dataset.id });
    });
  });

  // ── Detail view ──────────────────────────────────────────

  $('btn-back')?.addEventListener('click', () => navigate('list'));

  $('btn-edit')?.addEventListener('click', () => {
    state.editingId = state.activeId;
    navigate('form');
  });

  $('btn-delete')?.addEventListener('click', e => {
    state.deleteConfirmId = e.currentTarget.dataset.id;
    repaint();
  });

  // ── Form view ────────────────────────────────────────────

  $('btn-cancel')?.addEventListener('click', () => {
    if (state.editingId) navigate('detail', { activeId: state.editingId });
    else navigate('list');
  });

  $('btn-save')?.addEventListener('click', handleSave);

  $('recipe-form')?.addEventListener('submit', e => {
    e.preventDefault();
    handleSave();
  });

  // Live ratio calculation
  const fK = $('f-kaffeemenge');
  const fB = $('f-bruehmenge');
  if (fK && fB) {
    const updateRatio = () => {
      const preview = $('ratio-preview');
      if (!preview) return;
      const ratio = calcRatio(fK.value, fB.value);
      preview.innerHTML = ratio
        ? `<span class="ratio-preview__label">Brühverhältnis</span>
           <span class="ratio-preview__value">${h(ratio)}</span>`
        : '';
    };
    fK.addEventListener('input', updateRatio);
    fB.addEventListener('input', updateRatio);
  }

  // ── Delete dialog ────────────────────────────────────────

  $('btn-delete-cancel')?.addEventListener('click', () => {
    state.deleteConfirmId = null;
    repaint();
  });

  $('btn-delete-confirm')?.addEventListener('click', e => {
    handleDelete(e.currentTarget.dataset.id);
  });

  $('delete-dialog')?.addEventListener('click', e => {
    if (e.target === $('delete-dialog')) {
      state.deleteConfirmId = null;
      repaint();
    }
  });

  // Keyboard: close dialog on Escape
  document.addEventListener('keydown', handleKeydown, { once: true });
}

function handleKeydown(e) {
  if (e.key === 'Escape' && state.deleteConfirmId) {
    state.deleteConfirmId = null;
    repaint();
  }
}

// ============================================================
//  ACTIONS
// ============================================================

async function handleSave() {
  const form = document.getElementById('recipe-form');
  if (!form) return;

  const nameEl = form.querySelector('[name="name"]');
  if (!nameEl?.value.trim()) {
    nameEl?.classList.add('form-input--error');
    nameEl?.focus();
    showToast('Bitte gib einen Kaffeenamen ein.', 'error');
    return;
  }
  nameEl?.classList.remove('form-input--error');

  const fd = new FormData(form);
  const payload = {
    marke:       (fd.get('marke')       || '').trim(),
    name:        (fd.get('name')        || '').trim(),
    mahlgrad:    fd.get('mahlgrad')    !== '' && fd.get('mahlgrad')    != null ? Number(fd.get('mahlgrad'))    : null,
    mahlzeit:    fd.get('mahlzeit')    !== '' && fd.get('mahlzeit')    != null ? Number(fd.get('mahlzeit'))    : null,
    kaffeemenge: fd.get('kaffeemenge') !== '' && fd.get('kaffeemenge') != null ? Number(fd.get('kaffeemenge')) : null,
    sieb:        (fd.get('sieb')        || '').trim(),
    bruehzeit:   fd.get('bruehzeit')   !== '' && fd.get('bruehzeit')   != null ? Number(fd.get('bruehzeit'))   : null,
    bruehmenge:  fd.get('bruehmenge')  !== '' && fd.get('bruehmenge')  != null ? Number(fd.get('bruehmenge'))  : null,
    anwendung:   fd.getAll('anwendung'),
  };

  const saveBtn = document.getElementById('btn-save');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '…'; }

  try {
    if (state.editingId) {
      const updated = await api.update(state.editingId, payload);
      const idx = state.recipes.findIndex(r => r.id === state.editingId);
      if (idx !== -1) state.recipes[idx] = updated;
      showToast('Rezept gespeichert.');
      navigate('detail', { activeId: state.editingId });
    } else {
      const created = await api.create(payload);
      state.recipes.unshift(created);
      showToast('Rezept hinzugefügt.');
      navigate('detail', { activeId: created.id });
    }
  } catch (err) {
    console.error(err);
    showToast('Fehler beim Speichern.', 'error');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Speichern'; }
  }
}

async function handleDelete(id) {
  const confirmBtn = document.getElementById('btn-delete-confirm');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '…'; }

  try {
    await api.remove(id);
    state.recipes      = state.recipes.filter(r => r.id !== id);
    state.deleteConfirmId = null;
    showToast('Rezept gelöscht.');
    navigate('list');
  } catch (err) {
    console.error(err);
    showToast('Fehler beim Löschen.', 'error');
    state.deleteConfirmId = null;
    repaint();
  }
}

// ============================================================
//  INIT
// ============================================================

async function init() {
  state.loading = true;
  repaint();
  try {
    state.recipes = await api.getAll();
  } catch (err) {
    console.error(err);
    showToast('Rezepte konnten nicht geladen werden.', 'error');
  } finally {
    state.loading = false;
    repaint();
  }
}

document.addEventListener('DOMContentLoaded', init);
