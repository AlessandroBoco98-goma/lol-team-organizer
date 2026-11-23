const MAX_CHAMPIONS = 3;

// Riot ID "Nome#TAG" e regioni supportate (usati solo per costruire il link op.gg)
const RIOT_ID_REGEX = /^[^#]{3,16}#[A-Za-z0-9]{3,5}$/;
const REGIONS = ['EUW', 'EUNE', 'NA', 'KR', 'BR', 'LAN', 'LAS', 'OCE', 'TR', 'RU', 'JP'];

// Normalizza i campi opzionali riotId/region; ritorna { error } oppure { riotId, region } (entrambi opzionali)
function parseRiotFields(source) {
  const riotId = typeof source?.riotId === 'string' ? source.riotId.trim() : '';
  const region = typeof source?.region === 'string' ? source.region.trim().toUpperCase() : '';
  if (!riotId && !region) return {};
  if (!riotId || !region) return { error: 'Riot ID e regione vanno indicati insieme' };
  if (!RIOT_ID_REGEX.test(riotId)) return { error: 'Riot ID non valido (formato Nome#TAG)' };
  if (!REGIONS.includes(region)) return { error: 'Regione non valida' };
  return { riotId, region };
}

// Validazione di una sessione; ritorna un messaggio d'errore oppure null
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
    const riot = parseRiotFields(p);
    if (riot.error) return riot.error;
  }
  return null;
}

// Campi da salvare per una sessione già validata; playerId, riotId e region sono opzionali
function sessionFields(body) {
  const { date, time, players, notes } = body;
  return {
    date,
    time,
    players: players.map((p) => ({
      ...(typeof p.playerId === 'string' && p.playerId ? { playerId: p.playerId } : {}),
      name: p.name,
      role: p.role,
      champions: p.champions.map((c) => ({ id: c.id, name: c.name })),
      ...parseRiotFields(p),
    })),
    notes: notes || '',
  };
}

// Numero di telefono opzionale in formato internazionale (+39 333 1234567); ritorna { error } oppure { phone } o {}
function parsePhone(source) {
  const raw = typeof source?.phone === 'string' ? source.phone.trim() : '';
  if (!raw) return {};
  let phone = raw.replace(/[\s().-]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    return { error: 'Numero di telefono non valido (formato internazionale, es. +39 333 1234567)' };
  }
  return { phone };
}

const MAX_BANS = 5;
const MAX_ENEMY_PICKS = 5;
const MAX_DRAFT_NOTES = 2000;

// Lista di campioni { id, name }: senza duplicati e con un massimo; ritorna { error } oppure { list }
function parseChampionList(value, max, label) {
  if (value === undefined || value === null) return { list: [] };
  if (!Array.isArray(value)) return { error: `${label} non valido` };
  if (value.length > max) return { error: `${label}: massimo ${max}` };
  const list = [];
  for (const c of value) {
    if (typeof c?.id !== 'string' || typeof c?.name !== 'string' || !c.id) return { error: `${label}: campione non valido` };
    if (list.some((x) => x.id === c.id)) return { error: `${label}: campione duplicato` };
    list.push({ id: c.id, name: c.name });
  }
  return { list };
}

// Draft di una sessione: ban nostri e nemici, pick nemici e note sugli avversari. Ritorna { error } oppure { draft }
function parseDraft(body) {
  const allyBans = parseChampionList(body?.allyBans, MAX_BANS, 'Ban nostri');
  if (allyBans.error) return { error: allyBans.error };
  const enemyBans = parseChampionList(body?.enemyBans, MAX_BANS, 'Ban nemici');
  if (enemyBans.error) return { error: enemyBans.error };
  const enemyPicks = parseChampionList(body?.enemyPicks, MAX_ENEMY_PICKS, 'Pick nemici');
  if (enemyPicks.error) return { error: enemyPicks.error };
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';
  if (notes.length > MAX_DRAFT_NOTES) return { error: `Note: massimo ${MAX_DRAFT_NOTES} caratteri` };
  return { draft: { allyBans: allyBans.list, enemyBans: enemyBans.list, enemyPicks: enemyPicks.list, notes } };
}

const RSVP_STATUSES = ['yes', 'maybe', 'no'];
const VOTE_ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

// Valida il body di una risposta RSVP: { playerId, status, role } con status null/'' per annullare la risposta.
// Chi risponde "yes" deve indicare anche il ruolo con cui gioca.
// Ritorna { error } oppure { playerId, status } (status null = rimuovi) con role solo per "yes"
function parseRsvp(body) {
  const playerId = typeof body?.playerId === 'string' ? body.playerId.trim() : '';
  if (!playerId || playerId.length > 128) return { error: 'Giocatore mancante' };
  const raw = body.status;
  if (raw === null || raw === undefined || raw === '') return { playerId, status: null };
  if (!RSVP_STATUSES.includes(raw)) return { error: 'Stato RSVP non valido' };
  if (raw !== 'yes') return { playerId, status: raw };
  if (!VOTE_ROLES.includes(body.role)) return { error: 'Scegli il ruolo con cui giochi' };
  return { playerId, status: 'yes', role: body.role };
}

module.exports = {
  MAX_CHAMPIONS,
  RIOT_ID_REGEX,
  REGIONS,
  RSVP_STATUSES,
  parseRiotFields,
  parsePhone,
  parseDraft,
  parseRsvp,
  validateSession,
  sessionFields,
};
