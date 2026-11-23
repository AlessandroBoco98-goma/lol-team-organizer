const ROLES = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];
const MAX_PICKS = 3;

// Partite giocate in ogni ruolo, dal profilo Riot ({} se non ci sono dati)
function gamesByRole(profile) {
  const games = {};
  for (const r of profile?.roles ?? []) games[r.role] = r.games;
  return games;
}

// Assegna un ruolo a ciascun candidato scegliendo, tra tutte le combinazioni possibili (al massimo 5!),
// quella che somma più partite giocate nel ruolo assegnato. A parità vince la prima in ordine di
// candidati e di ruoli; chi non ha dati prende i ruoli che restano.
// candidates: [{ playerId, games: { TOP: n, ... } }]. Ritorna { playerId: role }.
function assignRoles(candidates, lockedRoles = []) {
  const free = ROLES.filter((r) => !lockedRoles.includes(r));
  if (candidates.length > free.length) throw new Error('Più giocatori che ruoli liberi');

  let best = { score: -1, picks: [] };
  const used = new Set();
  const picks = [];

  function search(i, score) {
    if (i === candidates.length) {
      if (score > best.score) best = { score, picks: [...picks] };
      return;
    }
    for (const role of free) {
      if (used.has(role)) continue;
      used.add(role);
      picks.push(role);
      search(i + 1, score + (candidates[i].games?.[role] ?? 0));
      picks.pop();
      used.delete(role);
    }
  }
  search(0, 0);

  return Object.fromEntries(candidates.map((c, i) => [c.playerId, best.picks[i]]));
}

// Fino a 3 campioni: prima i più giocati nel ruolo assegnato, poi i più giocati in assoluto
function pickChampions(profile, role, max = MAX_PICKS) {
  const ids = [];
  const add = (id) => {
    if (ids.length < max && id && !ids.includes(id)) ids.push(id);
  };
  for (const c of profile?.roles?.find((r) => r.role === role)?.champions ?? []) add(c.championId);
  for (const c of profile?.champions ?? []) add(c.championId);
  return ids;
}

// Chi ha già il ruolo in questa sessione, tra gli altri che hanno votato "Ci sono" o sono già in squadra.
// Ritorna l'id (o il nome) dell'altro giocatore, oppure null se il ruolo è libero per `playerId`.
function roleTakenBy({ rsvp = {}, voteRoles = {}, players = [] }, playerId, role) {
  for (const [id, r] of Object.entries(voteRoles)) {
    if (id !== playerId && r === role && rsvp[id] === 'yes') return id;
  }
  for (const p of players) {
    if (p.role === role && (p.playerId ?? p.name) !== playerId) return p.playerId ?? p.name;
  }
  return null;
}

const samePlayer = (p, voter) => (p.playerId ? p.playerId === voter.id : p.name === voter.name);

function buildPlayer(voter, role, profile, nameOf, keepChampions) {
  const champions = keepChampions ?? pickChampions(profile, role).map((id) => ({ id, name: nameOf(id) }));
  return {
    playerId: voter.id,
    name: voter.name,
    role,
    champions,
    ...(voter.riotId && voter.region ? { riotId: voter.riotId, region: voter.region } : {}),
  };
}

const byRoleOrder = (a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role);

// Compone la squadra con chi ha votato "Ci sono".
// - voters: giocatori del roster che hanno votato sì ({ id, name, riotId?, region? }), al massimo 5
// - voteRoles: { playerId: ruolo } scelto da ciascuno al momento del voto; chi non l'ha scelto riceve un ruolo libero
//   in base alle sue abitudini
// - existing: giocatori già in sessione; chi ha votato sì e non ha cambiato ruolo resta com'è (anche i campioni scelti a mano),
//   gli altri escono
// - profiles: { [playerId]: profilo Riot } per chi è stato possibile leggere
// - nameOf: id campione -> nome da mostrare
// Ritorna { players, withoutData }: withoutData sono i nomi dei giocatori senza dati Riot utilizzabili.
function planComposition({ voters, voteRoles = {}, existing = [], profiles = {}, nameOf = (id) => id }) {
  if (voters.length > ROLES.length) throw new Error('Più di 5 giocatori hanno confermato');

  // Ruolo scelto al voto, solo se valido e non scelto anche da un altro (in caso di doppione vale il primo)
  const chosen = {};
  const claimed = new Set();
  for (const v of voters) {
    const role = voteRoles[v.id];
    if (ROLES.includes(role) && !claimed.has(role)) {
      chosen[v.id] = role;
      claimed.add(role);
    }
  }

  const kept = new Map();
  for (const p of existing) {
    const voter = voters.find((v) => samePlayer(p, v));
    if (!voter || kept.has(voter.id)) continue;
    // Se ha cambiato ruolo votando, va ricalcolato come un nuovo arrivato (i campioni dipendono dal ruolo)
    if (chosen[voter.id] && chosen[voter.id] !== p.role) continue;
    kept.set(voter.id, { ...p, playerId: voter.id, name: voter.name });
  }

  const newcomers = voters.filter((v) => !kept.has(v.id));
  const locked = [...kept.values()].map((p) => p.role);
  for (const v of newcomers) if (chosen[v.id]) locked.push(chosen[v.id]);

  const unchosen = newcomers.filter((v) => !chosen[v.id]);
  const assigned = assignRoles(
    unchosen.map((v) => ({ playerId: v.id, games: gamesByRole(profiles[v.id]) })),
    locked,
  );

  const withoutData = [];
  const created = newcomers.map((v) => {
    const role = chosen[v.id] ?? assigned[v.id];
    const player = buildPlayer(v, role, profiles[v.id], nameOf);
    if (player.champions.length === 0) withoutData.push(v.name);
    return player;
  });

  return { players: [...kept.values(), ...created].sort(byRoleOrder), withoutData };
}

// Aggiorna la squadra dopo il voto di un solo giocatore, senza toccare gli altri:
// - "Ci sono" con ruolo: entra (o cambia ruolo), con i campioni più giocati in quel ruolo;
//   se il ruolo non è cambiato restano i campioni che aveva già
// - altro voto: esce dalla squadra
function applyVote({ existing = [], voter, isYes, role, profile, nameOf = (id) => id }) {
  const previous = existing.find((p) => samePlayer(p, voter));
  const rest = existing.filter((p) => !samePlayer(p, voter));
  if (!isYes) return { players: rest, withoutData: [] };

  const keep = previous && previous.role === role && previous.champions?.length > 0 ? previous.champions : undefined;
  const player = buildPlayer(voter, role, profile, nameOf, keep);
  return { players: [...rest, player].sort(byRoleOrder), withoutData: player.champions.length === 0 ? [voter.name] : [] };
}

module.exports = { ROLES, MAX_PICKS, gamesByRole, assignRoles, pickChampions, roleTakenBy, planComposition, applyVote };
