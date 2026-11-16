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

module.exports = { MAX_CHAMPIONS, RIOT_ID_REGEX, REGIONS, parseRiotFields, validateSession, sessionFields };
