'use strict';

// Abhängigkeiten: config.js muss vorher geladen sein
// (SIEB_OPTIONS, ANWENDUNG_OPTIONS, TAG_CLASS, state, h, calcRatio, fmtSec, fmtNum, filteredRecipes)

// ============================================================
//  RENDER-HILFSFUNKTIONEN
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
//  LISTENANSICHT
// ============================================================

function renderListView() {
  const list = filteredRecipes();

  return `
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

      ${state.searchVisible ? `
        <div class="search-bar">
          <label for="search-input" class="sr-only">Kaffee suchen</label>
          <div class="search-bar__inner">
            <i data-lucide="search" class="search-bar__icon"></i>
            <input type="search" id="search-input" class="search-bar__input"
              placeholder="Marke oder Name suchen…"
              value="${h(state.searchQuery)}"
              autocomplete="off" autocorrect="off" autocapitalize="off">
            ${state.searchQuery ? `
              <button class="search-bar__clear" id="btn-search-clear"
                aria-label="Suche löschen">
                <i data-lucide="x"></i>
              </button>` : ''}
          </div>
        </div>` : ''}

      <div class="list-content">
        ${state.loading
          ? renderSkeleton()
          : list.length === 0
            ? renderEmptyState()
            : `<ul class="recipe-list" role="list">
                ${list.map(renderCard).join('')}
               </ul>`}
      </div>
    </div>`;
}

function renderSkeleton() {
  return `
    <ul class="recipe-list" aria-busy="true" aria-label="Lade Rezepte…">
      ${[1, 2, 3].map(() => `
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
    return `
      <div class="empty-state">
        <div class="empty-state__icon"><i data-lucide="search-x"></i></div>
        <p class="empty-state__title">Keine Ergebnisse</p>
        <p class="empty-state__text">
          Für „${h(state.searchQuery)}" wurden keine Rezepte gefunden.
        </p>
        <button class="btn btn--ghost" id="btn-clear-search">Suche zurücksetzen</button>
      </div>`;
  }
  return `
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
    recipe.mahlgrad    != null ? { label: 'Mahlgrad', value: h(String(recipe.mahlgrad)) }                : null,
    recipe.kaffeemenge != null ? { label: 'Dosis',    value: `${h(String(recipe.kaffeemenge))}\u202Fg` } : null,
    ratio               ? { label: 'Ratio',    value: h(ratio) }                                         : null,
    recipe.sieb         ? { label: 'Sieb',     value: h(recipe.sieb), truncate: true }                   : null,
  ].filter(Boolean);

  return `
    <li>
      <button class="recipe-card" data-id="${h(recipe.id)}"
        aria-label="Rezept öffnen: ${h(recipe.marke)} ${h(recipe.name)}">
        <div class="recipe-card__header">
          <div class="recipe-card__title-group">
            <span class="recipe-card__brand">${h(recipe.marke) || '—'}</span>
            <span class="recipe-card__name">${h(recipe.name)  || '—'}</span>
          </div>
          <i data-lucide="chevron-right" class="recipe-card__arrow"></i>
        </div>
        ${tags.length ? `<div class="recipe-card__tags">${renderTags(tags)}</div>` : ''}
        ${stats.length ? `
          <div class="recipe-card__stats">
            ${stats.map(s => `
              <div class="stat">
                <span class="stat__label">${s.label}</span>
                <span class="stat__value${s.truncate ? ' stat__value--truncate' : ''}">${s.value}</span>
              </div>`).join('')}
          </div>` : ''}
      </button>
    </li>`;
}

// ============================================================
//  DETAILANSICHT
// ============================================================

function renderDetailView() {
  const r = state.recipes.find(x => x.id === state.activeId);
  if (!r) { navigate('list'); return ''; }

  const ratio = calcRatio(r.kaffeemenge, r.bruehmenge);

  return `
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
          ${(r.anwendung || []).length
            ? `<div class="detail-hero__tags">${renderTags(r.anwendung)}</div>`
            : ''}
        </div>

        <div class="detail-sections">

          ${r.sieb ? `
            <section class="detail-section" aria-label="Sieb">
              <h2 class="detail-section__title"><i data-lucide="circle"></i>Sieb</h2>
              <dl class="detail-grid">
                <div class="detail-row"><dt>Sieb</dt><dd>${h(r.sieb)}</dd></div>
              </dl>
            </section>` : ''}

          <section class="detail-section" aria-label="Mahlung">
            <h2 class="detail-section__title"><i data-lucide="settings-2"></i>Mahlung</h2>
            <dl class="detail-grid">
              <div class="detail-row"><dt>Mahlgrad</dt><dd>${fmtNum(r.mahlgrad)}</dd></div>
              <div class="detail-row"><dt>Mahlzeit</dt><dd>${fmtSec(r.mahlzeit)}</dd></div>
            </dl>
          </section>

          <section class="detail-section" aria-label="Extraktion">
            <h2 class="detail-section__title"><i data-lucide="droplets"></i>Extraktion</h2>
            <dl class="detail-grid">
              <div class="detail-row"><dt>Kaffeemenge</dt><dd>${fmtNum(r.kaffeemenge, 'g')}</dd></div>
              <div class="detail-row"><dt>Brühzeit</dt><dd>${fmtSec(r.bruehzeit)}</dd></div>
              <div class="detail-row"><dt>Brühmenge</dt><dd>${fmtNum(r.bruehmenge, 'ml')}</dd></div>
              ${ratio ? `
                <div class="detail-row detail-row--highlight">
                  <dt>Brühverhältnis</dt><dd>${h(ratio)}</dd>
                </div>` : ''}
            </dl>
          </section>

        </div>
      </div>
    </div>`;
}

// ============================================================
//  FORMULARANSICHT
// ============================================================

function renderFormView() {
  const r     = state.editingId ? state.recipes.find(x => x.id === state.editingId) : null;
  const v     = f => r && r[f] != null ? h(String(r[f])) : '';
  const chk   = opt => r && (r.anwendung || []).includes(opt);
  const title = state.editingId ? 'Rezept bearbeiten' : 'Neues Rezept';

  return `
    <div class="view view--form">
      <header class="header">
        <button class="icon-btn" id="btn-cancel" aria-label="Abbrechen">
          <i data-lucide="x"></i>
        </button>
        <span class="header__title">${h(title)}</span>
        <button class="btn btn--primary btn--sm" id="btn-save">Speichern</button>
      </header>

      <div class="form-content">
        <form id="recipe-form" novalidate aria-label="${h(title)}">

          <fieldset class="form-section">
            <legend class="form-section__title">Kaffee</legend>
            <div class="form-group">
              <label class="form-label" for="f-marke">Marke</label>
              <input type="text" id="f-marke" name="marke" class="form-input"
                value="${v('marke')}" placeholder="z. B. Gardelli, Five Elephant…"
                autocomplete="off">
            </div>
            <div class="form-group">
              <label class="form-label required" for="f-name">Name des Kaffees</label>
              <input type="text" id="f-name" name="name" class="form-input"
                value="${v('name')}" placeholder="z. B. Ethiopia Guji Natural"
                required autocomplete="off">
            </div>
          </fieldset>

          <fieldset class="form-section">
            <legend class="form-section__title">Mahlung</legend>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="f-mahlgrad">Mahlgrad</label>
                <input type="number" id="f-mahlgrad" name="mahlgrad" class="form-input"
                  value="${v('mahlgrad')}" placeholder="3.5" step="0.5" min="0">
              </div>
              <div class="form-group">
                <label class="form-label" for="f-mahlzeit">Mahlzeit</label>
                <div class="input-unit-wrap">
                  <input type="number" id="f-mahlzeit" name="mahlzeit" class="form-input"
                    value="${v('mahlzeit')}" placeholder="8" step="1" min="0">
                  <span class="input-unit">sek</span>
                </div>
              </div>
            </div>
          </fieldset>

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
                  <input type="number" id="f-kaffeemenge" name="kaffeemenge" class="form-input"
                    value="${v('kaffeemenge')}" placeholder="18" step="0.1" min="0">
                  <span class="input-unit">g</span>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="f-bruehmenge">Brühmenge</label>
                <div class="input-unit-wrap">
                  <input type="number" id="f-bruehmenge" name="bruehmenge" class="form-input"
                    value="${v('bruehmenge')}" placeholder="36" step="1" min="0">
                  <span class="input-unit">ml</span>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="f-bruehzeit">Brühzeit</label>
              <div class="input-unit-wrap">
                <input type="number" id="f-bruehzeit" name="bruehzeit" class="form-input"
                  value="${v('bruehzeit')}" placeholder="28" step="1" min="0">
                <span class="input-unit">sek</span>
              </div>
            </div>
            <div class="ratio-preview" id="ratio-preview">
              ${r?.kaffeemenge && r?.bruehmenge ? `
                <span class="ratio-preview__label">Brühverhältnis</span>
                <span class="ratio-preview__value">
                  ${h(calcRatio(r.kaffeemenge, r.bruehmenge) || '—')}
                </span>` : ''}
            </div>
          </fieldset>

          <fieldset class="form-section">
            <legend class="form-section__title">Anwendung</legend>
            <div class="checkbox-group" role="group" aria-label="Anwendung wählen">
              ${ANWENDUNG_OPTIONS.map(opt => `
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
//  LÖSCH-DIALOG
// ============================================================

function renderDeleteDialog() {
  return `
    <div class="dialog-overlay" id="delete-dialog"
      role="dialog" aria-modal="true" aria-labelledby="dlg-title">
      <div class="dialog">
        <div class="dialog__icon"><i data-lucide="trash-2"></i></div>
        <h2 class="dialog__title" id="dlg-title">Rezept löschen?</h2>
        <p class="dialog__text">
          Dieser Eintrag wird dauerhaft gelöscht.<br>
          Die Aktion kann nicht rückgängig gemacht werden.
        </p>
        <div class="dialog__actions">
          <button class="btn btn--ghost" id="btn-delete-cancel">Abbrechen</button>
          <button class="btn btn--danger" id="btn-delete-confirm"
            data-id="${h(state.deleteConfirmId)}">Löschen</button>
        </div>
      </div>
    </div>`;
}
