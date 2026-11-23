require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { FieldValue, FieldPath } = require('firebase-admin/firestore');
const { db } = require('./firebase');
const { createRiotService } = require('./riot');
const { ROLES, planComposition, applyVote, roleTakenBy } = require('./autofill');
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

// Servizio Riot (rank, partite, ruoli e pick): attivo solo se c'è la chiave sul server
const riot = process.env.RIOT_API_KEY ? createRiotService({ apiKey: process.env.RIOT_API_KEY }) : null;

// Nomi dei campioni (id -> nome) da Data Dragon, in cache per qualche ora
let championNamesCache = { at: 0, names: {} };
async function championNames() {
  if (Date.now() - championNamesCache.at < 6 * 60 * 60 * 1000 && Object.keys(championNamesCache.names).length > 0) {
    return championNamesCache.names;
  }
  try {
    const list = await DDragon.getChampions();
    championNamesCache = { at: Date.now(), names: Object.fromEntries(list.map((c) => [c.id, c.name])) };
  } catch {
    // senza Data Dragon i campioni vengono mostrati con il loro id
  }
  return championNamesCache.names;
}

function httpError(status, message) {
  return Object.assign(new Error(message), { httpStatus: status });
}

// Un giocatore del roster ha bisogno del profilo Riot se non è già in squadra nel ruolo votato con dei campioni
function needsRiotProfile(voter, session) {
  const entry = (session.players ?? []).find((p) => (p.playerId ? p.playerId === voter.id : p.name === voter.name));
  const role = session.voteRoles?.[voter.id];
  const settled = entry && entry.champions?.length > 0 && (!role || role === entry.role);
  return !settled && !!riot && !!voter.riotId && !!voter.region;
}

// Legge i profili Riot (ruoli e campioni più giocati dalle ultime partite dell'account collegato).
// Un giocatore alla volta: ogni profilo fa una decina di chiamate e il limite di Riot è basso.
async function fetchProfiles(voters, session) {
  const profiles = {};
  for (const voter of voters) {
    if (!needsRiotProfile(voter, session)) continue;
    try {
      profiles[voter.id] = await riot.getProfile(voter.riotId, voter.region);
    } catch (error) {
      console.error(`Profilo Riot non letto per ${voter.name}:`, error.message);
      if (error.status === 429) break; // limite raggiunto: inutile insistere con gli altri
    }
  }
  return profiles;
}

// Resoconto dell'ultima compilazione, salvato nella sessione: la pagina lo usa per spiegare perché mancano i campioni
const fillReport = (withoutData) => ({ at: new Date().toISOString(), riotEnabled: !!riot, withoutData });

// Compila la squadra di una sessione con chi ha votato "Ci sono": il ruolo è quello scelto al voto,
// i campioni sono i più giocati in quel ruolo, letti dalle ultime partite Riot dell'account collegato
// (Riot ID e regione del giocatore). Chi era già in squadra nello stesso ruolo resta com'è;
// chi non ha dati entra comunque, senza campioni.
async function autofillSession(sessionId) {
  const ref = sessionsRef.doc(sessionId);
  const first = await ref.get();
  if (!first.exists) throw httpError(404, 'Not found');
  const roster = (await playersRef.get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  const firstVoters = roster.filter((p) => first.data().rsvp?.[p.id] === 'yes');
  if (firstVoters.length === 0) throw httpError(400, 'Nessuno ha ancora confermato');
  if (firstVoters.length > ROLES.length) {
    throw httpError(400, `Hanno confermato in ${firstVoters.length}: i ruoli sono ${ROLES.length}, scegli la squadra a mano da "Modifica"`);
  }

  // Le chiamate a Riot stanno fuori dalla transazione: sono lente e Firestore la ripeterebbe
  const profiles = await fetchProfiles(firstVoters, first.data());
  const names = await championNames();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const session = snap.data();
    const voters = roster.filter((p) => session.rsvp?.[p.id] === 'yes'); // voti aggiornati a questo istante
    if (voters.length > ROLES.length) throw httpError(400, 'Più di 5 giocatori hanno confermato: scegli la squadra a mano da "Modifica"');

    const { players, withoutData } = planComposition({
      voters,
      voteRoles: session.voteRoles ?? {},
      existing: session.players ?? [],
      profiles,
      nameOf: (id) => names[id] ?? id,
    });
    const normalized = sessionFields({ date: session.date, time: session.time, players, notes: session.notes }).players;
    const report = fillReport(withoutData);
    tx.update(ref, { players: normalized, updatedAt: report.at, autoFillReport: report });
    return { players: normalized, withoutData, riotEnabled: report.riotEnabled };
  });
}

// Dopo un voto su una sessione già confermata nata dalla votazione, aggiorna la squadra solo per quel giocatore:
// entra (o cambia ruolo) con i campioni del suo ruolo, oppure esce se non dice più "Ci sono".
// Le altre sessioni (create a mano) non vengono toccate dai voti.
async function applyVoteToSession(sessionId, playerId) {
  const ref = sessionsRef.doc(sessionId);
  const first = await ref.get();
  const data = first.exists ? first.data() : null;
  if (!data || data.status !== 'confirmed' || data.source !== 'weekly') return;

  const playerDoc = await playersRef.doc(playerId).get();
  if (!playerDoc.exists) return;
  const voter = { id: playerDoc.id, ...playerDoc.data() };
  const profiles = data.rsvp?.[playerId] === 'yes' ? await fetchProfiles([voter], data) : {};
  const names = await championNames();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const session = snap.data();
    const isYes = session.rsvp?.[playerId] === 'yes';
    const { players, withoutData } = applyVote({
      existing: session.players ?? [],
      voter,
      isYes,
      role: session.voteRoles?.[playerId],
      profile: profiles[playerId],
      nameOf: (id) => names[id] ?? id,
    });
    const normalized = sessionFields({ date: session.date, time: session.time, players, notes: session.notes }).players;
    const previous = session.autoFillReport?.withoutData ?? [];
    const merged = [...previous.filter((n) => n !== voter.name), ...withoutData];
    tx.update(ref, { players: normalized, updatedAt: new Date().toISOString(), autoFillReport: fillReport(merged) });
  });
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
// Chi dice "Ci sono" sceglie anche il ruolo (voteRoles.<playerId>), tra quelli non già presi da un altro.
// Se la sessione è una proposta e con questo voto i "Ci sono" arrivano alla soglia, diventa una sessione vera
// (status: 'confirmed'). Lettura e scrittura stanno in una transazione: due voti insieme non si perdono,
// e due persone non possono scegliere lo stesso ruolo.
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

    if (parsed.status === 'yes') {
      const holder = roleTakenBy({ rsvp, voteRoles: data.voteRoles ?? {}, players: data.players ?? [] }, parsed.playerId, parsed.role);
      if (holder) return { conflict: true };
    }

    const confirmedNow = shouldConfirm(data.status, rsvp);
    const fields = [
      new FieldPath('rsvp', parsed.playerId),
      parsed.status ?? FieldValue.delete(),
      new FieldPath('voteRoles', parsed.playerId),
      parsed.status === 'yes' ? parsed.role : FieldValue.delete(),
    ];
    if (confirmedNow) fields.push('status', 'confirmed', 'confirmedAt', new Date().toISOString());
    tx.update(ref, ...fields);
    return {
      confirmedNow,
      sessionStatus: confirmedNow ? 'confirmed' : (data.status ?? 'confirmed'),
      alreadyConfirmed: !confirmedNow && data.status === 'confirmed' && data.source === 'weekly',
    };
  });

  if (!result) return res.status(404).json({ error: 'Not found' });
  if (result.conflict) return res.status(409).json({ error: 'Quel ruolo è già stato scelto da un altro giocatore: scegline uno libero' });
  const { alreadyConfirmed, ...body } = result;
  res.json({ id: req.params.id, playerId: parsed.playerId, status: parsed.status, role: parsed.role ?? null, ...body });

  // Dopo la risposta, così il voto non aspetta le chiamate a Riot; il browser aggiorna la sessione poco dopo.
  // Alla conferma la squadra si compila per intero; sui voti successivi cambia solo il giocatore che ha votato.
  const background = result.confirmedNow ? autofillSession(req.params.id) : alreadyConfirmed ? applyVoteToSession(req.params.id, parsed.playerId) : null;
  background?.catch((error) => console.error('Compilazione automatica non riuscita:', error.message));
});

// Compila (o ricompila) la squadra con chi ha votato "Ci sono": è la stessa operazione che parte da sola alla conferma
app.post('/api/sessions/:id/autofill', async (req, res) => {
  try {
    res.json(await autofillSession(req.params.id));
  } catch (error) {
    if (!error.httpStatus) throw error;
    res.status(error.httpStatus).json({ error: error.message });
  }
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
