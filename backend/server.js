require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { FieldValue, FieldPath } = require('firebase-admin/firestore');
const { db } = require('./firebase');
const { createRiotService } = require('./riot');
const { WEEK_SESSION_TIME, nextWorkweekDates, planWeek, shouldConfirm, weekSessionId } = require('./weekly');
const { parseRiotFields, parsePhone, parseDraft, parseRsvp, validateSession, sessionFields } = require('./validation');

const app = express();
const PORT = process.env.PORT || 3001;
const TEAM_PASSWORD = process.env.TEAM_PASSWORD;

app.use(cors());
app.use(express.json());

// Letture pubbliche; ogni modifica richiede la password del team.
// Unica eccezione: la generazione settimanale, chiamata dal cron e protetta da CRON_SECRET (vedi sotto).
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'OPTIONS') return next();
  if (req.method === 'POST' && req.path === '/sessions/generate-week') return next();
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
      tags: champ.tags || [],
      info: champ.info || null,
      image: `${this.baseUrl}/cdn/${v}/img/champion/${key}.png`,
    }));
  },
};

// Collections
const sessionsRef = db.collection('sessions');
const playersRef = db.collection('players');

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

// Confronto di segreti a tempo costante (si confrontano gli hash, quindi la lunghezza non conta)
function secretsMatch(provided, expected) {
  const hash = (s) => crypto.createHash('sha256').update(String(s ?? '')).digest();
  return crypto.timingSafeEqual(hash(provided), hash(expected));
}

// Crea le PROPOSTE (21:30) della prossima settimana, da lunedì a venerdì, fuso Europe/Rome.
// Una proposta non è ancora una sessione: sta nella pagina di votazione e non compare nel calendario
// finché non arriva alle conferme necessarie (vedi la rotta rsvp).
// Chiamata dal cron di GitHub Actions con l'header x-cron-secret; NON usa la password del team.
// Idempotente: una data che ha già una sessione alla stessa ora viene saltata.
app.post('/api/sessions/generate-week', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return res.status(500).json({ error: 'CRON_SECRET non configurata sul server' });
  if (!secretsMatch(req.get('x-cron-secret'), cronSecret)) return res.status(401).json({ error: 'Secret non valido' });

  const dates = nextWorkweekDates();
  const snapshot = await sessionsRef.where('date', 'in', dates).get();
  const existing = snapshot.docs.map((doc) => ({ date: doc.get('date'), time: doc.get('time') }));
  const { toCreate, skipped } = planWeek(dates, existing, WEEK_SESSION_TIME);

  let created = 0;
  let skippedCount = skipped.length;
  const createdAt = new Date().toISOString();
  for (const date of toCreate) {
    const data = {
      ...sessionFields({ date, time: WEEK_SESSION_TIME, players: [], notes: '' }),
      status: 'proposal',
      source: 'weekly',
      createdAt,
    };
    try {
      // create() fallisce se l'id esiste già: protegge da due esecuzioni in contemporanea
      await sessionsRef.doc(weekSessionId(date, WEEK_SESSION_TIME)).create(data);
      created += 1;
    } catch (error) {
      if (error.code !== 6) throw error; // 6 = ALREADY_EXISTS
      skippedCount += 1;
    }
  }

  res.json({ created, skipped: skippedCount, dates });
});

app.put('/api/sessions/:id', async (req, res) => {
  const error = validateSession(req.body);
  if (error) return res.status(400).json({ error });
  const data = { ...sessionFields(req.body), updatedAt: new Date().toISOString() };
  await sessionsRef.doc(req.params.id).update(data);
  res.json({ id: req.params.id, ...data });
});

// Risposta di disponibilità di un giocatore (rsvp.<playerId>); non tocca gli altri campi della sessione.
// Se la sessione è una proposta e con questo voto i "Ci sono" arrivano alla soglia, diventa una sessione vera
// (status: 'confirmed'). Lettura e scrittura stanno in una transazione: due voti insieme non si perdono.
app.put('/api/sessions/:id/rsvp', async (req, res) => {
  const parsed = parseRsvp(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const ref = sessionsRef.doc(req.params.id);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const data = snap.data();
    const rsvp = { ...(data.rsvp ?? {}) };
    if (parsed.status) rsvp[parsed.playerId] = parsed.status;
    else delete rsvp[parsed.playerId];

    const confirmedNow = shouldConfirm(data.status, rsvp);
    const fields = [new FieldPath('rsvp', parsed.playerId), parsed.status ?? FieldValue.delete()];
    if (confirmedNow) fields.push('status', 'confirmed', 'confirmedAt', new Date().toISOString());
    tx.update(ref, ...fields);
    return { confirmedNow, sessionStatus: confirmedNow ? 'confirmed' : (data.status ?? 'confirmed') };
  });

  if (!result) return res.status(404).json({ error: 'Not found' });
  res.json({ id: req.params.id, playerId: parsed.playerId, status: parsed.status, ...result });
});

// Draft (ban, pick nemici, note): si salva a parte per non toccare la composizione né le risposte
app.put('/api/sessions/:id/draft', async (req, res) => {
  const parsed = parseDraft(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const ref = sessionsRef.doc(req.params.id);
  const doc = await ref.get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found' });
  await ref.update({ draft: parsed.draft });
  res.json({ id: req.params.id, draft: parsed.draft });
});

app.delete('/api/sessions/:id', async (req, res) => {
  await sessionsRef.doc(req.params.id).delete();
  res.status(204).send();
});

// Players
app.get('/api/players', async (req, res) => {
  const snapshot = await playersRef.get();
  // I numeri di telefono sono dati personali: li vede solo chi ha la password del team
  const authed = !!TEAM_PASSWORD && req.get('x-team-password') === TEAM_PASSWORD;
  const players = [];
  snapshot.forEach((doc) => {
    const { phone, ...publicData } = doc.data();
    // Senza password si sa solo che il numero esiste (hasPhone), così il form non lo cancella per errore
    players.push({
      id: doc.id,
      ...publicData,
      ...(authed ? (phone ? { phone } : {}) : phone ? { hasPhone: true } : {}),
    });
  });
  res.json(players);
});

app.post('/api/players', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const riot = parseRiotFields(req.body);
  if (riot.error) return res.status(400).json({ error: riot.error });
  const contact = parsePhone(req.body);
  if (contact.error) return res.status(400).json({ error: contact.error });
  const data = { name: name.trim(), ...riot, ...contact, createdAt: new Date().toISOString() };
  const docRef = await playersRef.add(data);
  res.status(201).json({ id: docRef.id, ...data });
});

app.put('/api/players/:id', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const riot = parseRiotFields(req.body);
  if (riot.error) return res.status(400).json({ error: riot.error });
  const contact = parsePhone(req.body);
  if (contact.error) return res.status(400).json({ error: contact.error });
  // Se riotId/region/phone non sono forniti, i campi esistenti vengono rimossi
  const data = {
    name: name.trim(),
    riotId: riot.riotId ?? FieldValue.delete(),
    region: riot.region ?? FieldValue.delete(),
    // Il numero cambia solo se il campo è presente nella richiesta
    ...('phone' in req.body ? { phone: contact.phone ?? FieldValue.delete() } : {}),
  };
  await playersRef.doc(req.params.id).update(data);
  res.json({ id: req.params.id, name: data.name, ...riot, ...('phone' in req.body ? contact : {}) });
});

app.delete('/api/players/:id', async (req, res) => {
  await playersRef.doc(req.params.id).delete();
  res.status(204).send();
});

// Statistiche Riot di un giocatore (rank, ultime partite, build abituali).
// La chiave Riot resta qui sul server; l'endpoint richiede la password del team per non consumare il limite di richieste.
const riot = process.env.RIOT_API_KEY ? createRiotService({ apiKey: process.env.RIOT_API_KEY }) : null;

app.get('/api/players/:id/riot', async (req, res) => {
  if (!TEAM_PASSWORD || req.get('x-team-password') !== TEAM_PASSWORD) {
    return res.status(401).json({ error: 'Password del team richiesta' });
  }
  if (!riot) return res.status(503).json({ error: 'Statistiche Riot non configurate sul server (manca RIOT_API_KEY)' });
  const doc = await playersRef.doc(req.params.id).get();
  if (!doc.exists) return res.status(404).json({ error: 'Not found' });
  const { riotId, region } = doc.data();
  if (!riotId || !region) return res.status(400).json({ error: 'Imposta Riot ID e regione del giocatore' });
  try {
    res.json(await riot.getProfile(riotId, region));
  } catch (error) {
    if (typeof error?.status !== 'number') throw error;
    if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
    res.status(error.status).json({ error: error.message, ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}) });
  }
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
