'use strict';

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'recipes.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── helpers ────────────────────────────────────────────────────────────────

async function readRecipes() {
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

async function writeRecipes(recipes) {
  await fs.writeFile(DATA_FILE, JSON.stringify(recipes, null, 2), 'utf8');
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
}

// ── routes ─────────────────────────────────────────────────────────────────

// GET /api/recipes – return all recipes (newest first)
app.get('/api/recipes', async (_req, res) => {
  try {
    const recipes = await readRecipes();
    res.json(recipes);
  } catch (err) {
    console.error('GET /api/recipes', err);
    res.status(500).json({ error: 'Rezepte konnten nicht geladen werden.' });
  }
});

// POST /api/recipes – create a new recipe
app.post('/api/recipes', async (req, res) => {
  try {
    const recipes = await readRecipes();
    const recipe = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...sanitize(req.body),
    };
    recipes.unshift(recipe);
    await writeRecipes(recipes);
    res.status(201).json(recipe);
  } catch (err) {
    console.error('POST /api/recipes', err);
    res.status(500).json({ error: 'Rezept konnte nicht erstellt werden.' });
  }
});

// PUT /api/recipes/:id – update an existing recipe
app.put('/api/recipes/:id', async (req, res) => {
  try {
    const recipes = await readRecipes();
    const idx = recipes.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Rezept nicht gefunden.' });
    recipes[idx] = {
      ...recipes[idx],
      ...sanitize(req.body),
      id: req.params.id,
      updatedAt: new Date().toISOString(),
    };
    await writeRecipes(recipes);
    res.json(recipes[idx]);
  } catch (err) {
    console.error('PUT /api/recipes/:id', err);
    res.status(500).json({ error: 'Rezept konnte nicht aktualisiert werden.' });
  }
});

// DELETE /api/recipes/:id – delete a recipe
app.delete('/api/recipes/:id', async (req, res) => {
  try {
    const recipes = await readRecipes();
    const filtered = recipes.filter(r => r.id !== req.params.id);
    if (filtered.length === recipes.length) {
      return res.status(404).json({ error: 'Rezept nicht gefunden.' });
    }
    await writeRecipes(filtered);
    res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/recipes/:id', err);
    res.status(500).json({ error: 'Rezept konnte nicht gelöscht werden.' });
  }
});

// ── sanitize ───────────────────────────────────────────────────────────────

function sanitize(body) {
  return {
    marke:       String(body.marke       ?? '').trim(),
    name:        String(body.name        ?? '').trim(),
    mahlgrad:    body.mahlgrad    != null && body.mahlgrad !== '' ? Number(body.mahlgrad)    : null,
    mahlzeit:    body.mahlzeit    != null && body.mahlzeit !== '' ? Number(body.mahlzeit)    : null,
    kaffeemenge: body.kaffeemenge != null && body.kaffeemenge !== '' ? Number(body.kaffeemenge) : null,
    sieb:        String(body.sieb        ?? '').trim(),
    bruehzeit:   body.bruehzeit   != null && body.bruehzeit !== '' ? Number(body.bruehzeit)   : null,
    bruehmenge:  body.bruehmenge  != null && body.bruehmenge !== '' ? Number(body.bruehmenge)  : null,
    anwendung:   Array.isArray(body.anwendung) ? body.anwendung.map(String) : [],
  };
}

// ── start ──────────────────────────────────────────────────────────────────

ensureDataFile().then(() => {
  app.listen(PORT, () => {
    console.log(`Brewmaster running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Startup error:', err);
  process.exit(1);
});
