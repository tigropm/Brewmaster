'use strict';

// Abhängigkeiten: config.js + render.js müssen vorher geladen sein

// ============================================================
//  NAVIGATION & REPAINT
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
  if      (state.view === 'list')   html = renderListView();
  else if (state.view === 'detail') html = renderDetailView();
  else if (state.view === 'form')   html = renderFormView();

  if (state.deleteConfirmId) html += renderDeleteDialog();

  root.innerHTML = html;
  lucide.createIcons();
  bindEvents();
}

// ============================================================
//  EVENTS
// ============================================================

function bindEvents() {
  const $ = id => document.getElementById(id);

  // ── Liste ────────────────────────────────────────────────

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
    // Cursor-Position nach repaint erhalten
    const inp = $('search-input');
    if (inp) { inp.focus(); const l = inp.value.length; inp.setSelectionRange(l, l); }
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

  // ── Detail ───────────────────────────────────────────────

  $('btn-back')?.addEventListener('click', () => navigate('list'));

  $('btn-edit')?.addEventListener('click', () => {
    state.editingId = state.activeId;
    navigate('form');
  });

  $('btn-delete')?.addEventListener('click', e => {
    state.deleteConfirmId = e.currentTarget.dataset.id;
    repaint();
  });

  // ── Formular ─────────────────────────────────────────────

  $('btn-cancel')?.addEventListener('click', () => {
    if (state.editingId) navigate('detail', { activeId: state.editingId });
    else navigate('list');
  });

  $('btn-save')?.addEventListener('click', handleSave);

  $('recipe-form')?.addEventListener('submit', e => {
    e.preventDefault();
    handleSave();
  });

  // Live Brühverhältnis im Formular
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

  // ── Dialog ───────────────────────────────────────────────

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

  // Escape schließt Dialog
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.deleteConfirmId) {
      state.deleteConfirmId = null;
      repaint();
    }
  }, { once: true });
}

// ============================================================
//  AKTIONEN
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
  nameEl.classList.remove('form-input--error');

  const fd      = new FormData(form);
  const payload = {
    marke:       (fd.get('marke')       || '').trim(),
    name:        (fd.get('name')        || '').trim(),
    mahlgrad:    fd.get('mahlgrad')    || null,
    mahlzeit:    fd.get('mahlzeit')    || null,
    kaffeemenge: fd.get('kaffeemenge') || null,
    sieb:        (fd.get('sieb')        || '').trim(),
    bruehzeit:   fd.get('bruehzeit')   || null,
    bruehmenge:  fd.get('bruehmenge')  || null,
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
    state.recipes         = state.recipes.filter(r => r.id !== id);
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
//  START
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
