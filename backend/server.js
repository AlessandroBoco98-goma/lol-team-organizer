require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { db } = require('./firebase');

const app = express();
const PORT = process.env.PORT || 3001;
const TEAM_PASSWORD = process.env.TEAM_PASSWORD;
const MAX_CHAMPIONS = 3;

app.use(cors());
app.use(express.json());

// Letture pubbliche; ogni modifica richiede la password del team
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'OPTIONS') return next();
  if (!TEAM_PASSWORD) return res.status(500).json({ error: 'TEAM_PASSWORD non configurata sul server' });
  if (req.get('x-team-password') !== TEAM_PASSWORD) return res.status(401).json({ error: 'Password non valida' });
  next();
});

// DDragon API
const DDragon = {
  baseUrl: 'https://ddragon.leagueoflegends.com',
  async getLatestVersion() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/versions.json`);
      return response.data[0];
    } catch {
      return '16.22.1';
    }
  },
  async getChampions(version = null, locale = 'it_IT') {
    const v = version || await this.getLatestVersion();
    const response = await axios.get(`${this.baseUrl}/cdn/${v}/data/${locale}/champion.json`);
    return Object.entries(response.data.data).map(([key, champ]) => ({
      id: key,
      name: champ.name,
      key: champ.key,
      image: `${this.baseUrl}/cdn/${v}/img/champion/${key}.png`,
    }));
  },
};

// Collections
const sessionsRef = db.collection('sessions');
const playersRef = db.collection('players');

// Validazione e normalizzazione di una sessione
function validateSession(body) {
  const { date, time, players } = body;
  if (!date || !time || !Array.isArray(players)) return 'Campi mancanti';
  const roles = players.map((p) => p.role);
  if (roles.length !== new Set(roles).size) return 'Ruoli duplicati';
  for (const p of players) {
    if (!p.name) return 'Nome giocatore mancante';
    if (!Array.isArray(p.champions) || p.champions.length > MAX_CHAMPIONS) {
      return `Ogni giocatore può avere fino a ${MAX_CHAMPIONS} campioni`;
    }
    if (p.champions.some((c) => typeof c?.id !== 'string' || typeof c?.name !== 'string')) {
      return 'Campione non valido';
    }
  }
  return null;
}

function sessionFields(body) {
  const { date, time, players, notes } = body;
  return {
    date,
    time,
    players: players.map((p) => ({
      name: p.name,
      role: p.role,
      champions: p.champions.map((c) => ({ id: c.id, name: c.name })),
    })),
    notes: notes || '',
  };
}

// API Routes
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Sessions
app.get('/api/sessions', async (req, res) => {
  const snapshot = await sessionsRef.orderBy('date', 'asc').get();
  const sessions = [];
  snapshot.forEach(doc => sessions.push({ id: doc.id, ...doc.data() }));
  res.json(sessions);
});

app.get('/api/sessions/:id', async (req, res) => {
  const doc = await sessionsRef.doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found' });
  res.json({ id: doc.id, ...doc.data() });
});

app.post('/api/sessions', async (req, res) => {
  const error = validateSession(req.body);
  if (error) return res.status(400).json({ error });
  const data = { ...sessionFields(req.body), createdAt: new Date().toISOString() };
  const docRef = await sessionsRef.add(data);
  res.status(201).json({ id: docRef.id, ...data });
});

app.put('/api/sessions/:id', async (req, res) => {
  const error = validateSession(req.body);
  if (error) return res.status(400).json({ error });
  const data = { ...sessionFields(req.body), updatedAt: new Date().toISOString() };
  await sessionsRef.doc(req.params.id).update(data);
  res.json({ id: req.params.id, ...data });
});

app.delete('/api/sessions/:id', async (req, res) => {
  await sessionsRef.doc(req.params.id).delete();
  res.status(204).send();
});

// Players
app.get('/api/players', async (req, res) => {
  const snapshot = await playersRef.get();
  const players = [];
  snapshot.forEach(doc => players.push({ id: doc.id, ...doc.data() }));
  res.json(players);
});

app.post('/api/players', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const docRef = await playersRef.add({ name: name.trim(), createdAt: new Date().toISOString() });
  res.status(201).json({ id: docRef.id, name });
});

app.put('/api/players/:id', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  await playersRef.doc(req.params.id).update({ name: name.trim() });
  res.json({ id: req.params.id, name });
});

app.delete('/api/players/:id', async (req, res) => {
  await playersRef.doc(req.params.id).delete();
  res.status(204).send();
});

// Champions
app.get('/api/champions', async (req, res) => {
  try {
    const champions = await DDragon.getChampions(req.query.version, req.query.locale || 'it_IT');
    res.json(champions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch champions' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
