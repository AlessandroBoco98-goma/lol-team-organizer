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

// Compone la squadra con chi ha votato "Ci sono".
// - voters: giocatori del roster che hanno votato sì ({ id, name, riotId?, region? }), al massimo 5
// - existing: giocatori già in sessione; chi ha votato sì resta com'è (ruolo e campioni scelti a mano), gli altri escono
// - profiles: { [playerId]: profilo Riot } per chi è stato possibile leggere
// - nameOf: id campione -> nome da mostrare
// Ritorna { players, withoutData }: withoutData sono i nomi dei nuovi giocatori senza dati Riot utilizzabili.
function planComposition({ voters, existing = [], profiles = {}, nameOf = (id) => id }) {
  if (voters.length > ROLES.length) throw new Error('Più di 5 giocatori hanno confermato');

  const keptByVoter = new Map();
  for (const p of existing) {
    const voter = voters.find((v) => (p.playerId ? v.id === p.playerId : v.name === p.name));
    if (voter && !keptByVoter.has(voter.id)) keptByVoter.set(voter.id, { ...p, playerId: voter.id, name: voter.name });
  }

  const newcomers = voters.filter((v) => !keptByVoter.has(v.id));
  const locked = [...keptByVoter.values()].map((p) => p.role);
  const roles = assignRoles(
    newcomers.map((v) => ({ playerId: v.id, games: gamesByRole(profiles[v.id]) })),
    locked,
  );

  const withoutData = [];
  const created = newcomers.map((v) => {
    const profile = profiles[v.id];
    const role = roles[v.id];
    const champions = pickChampions(profile, role).map((id) => ({ id, name: nameOf(id) }));
    if (champions.length === 0) withoutData.push(v.name);
    return {
      playerId: v.id,
      name: v.name,
      role,
      champions,
      ...(v.riotId && v.region ? { riotId: v.riotId, region: v.region } : {}),
    };
  });

  const players = [...keptByVoter.values(), ...created].sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
  return { players, withoutData };
}

module.exports = { ROLES, MAX_PICKS, gamesByRole, assignRoles, pickChampions, planComposition };
