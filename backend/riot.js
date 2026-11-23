const { RIOT_ID_REGEX } = require('./validation');

// Piattaforma (rank) e cluster regionali: "match" per le partite, "account" per l'Account-V1,
// che non supporta il cluster "sea"
const ROUTING = {
  EUW: { platform: 'euw1', match: 'europe', account: 'europe' },
  EUNE: { platform: 'eun1', match: 'europe', account: 'europe' },
  TR: { platform: 'tr1', match: 'europe', account: 'europe' },
  RU: { platform: 'ru', match: 'europe', account: 'europe' },
  NA: { platform: 'na1', match: 'americas', account: 'americas' },
  BR: { platform: 'br1', match: 'americas', account: 'americas' },
  LAN: { platform: 'la1', match: 'americas', account: 'americas' },
  LAS: { platform: 'la2', match: 'americas', account: 'americas' },
  OCE: { platform: 'oc1', match: 'sea', account: 'americas' },
  KR: { platform: 'kr', match: 'asia', account: 'asia' },
  JP: { platform: 'jp1', match: 'asia', account: 'asia' },
};

class RiotError extends Error {
  constructor(status, message, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

// Nelle partite Riot scrive alcuni campioni diversamente dall'id di Data Dragon
const CHAMPION_NAME_FIXES = { FiddleSticks: 'Fiddlesticks' };
const normalizeChampionName = (name) => CHAMPION_NAME_FIXES[name] ?? name;

const QUEUE_KEYS = { RANKED_SOLO_5x5: 'solo', RANKED_FLEX_SR: 'flex' };

// Ruoli di Match-V5 (teamPosition) -> ruoli dell'app
const APP_ROLES = { TOP: 'TOP', JUNGLE: 'JUNGLE', MIDDLE: 'MID', BOTTOM: 'ADC', UTILITY: 'SUPPORT' };

function mostCommon(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
}

// Trasforma le partite grezze di Match-V5 in ciò che serve all'app: ultime partite e statistiche per campione.
// Si considerano solo le partite su Summoner's Rift (CLASSIC).
function summarizeMatches(puuid, matches) {
  const games = [];
  for (const m of matches) {
    const info = m?.info;
    if (!info || info.gameMode !== 'CLASSIC') continue;
    const p = info.participants?.find((x) => x.puuid === puuid);
    if (!p) continue;
    const durationSec = info.gameDuration > 100000 ? Math.round(info.gameDuration / 1000) : info.gameDuration;
    games.push({
      matchId: m.metadata?.matchId ?? String(info.gameId),
      championId: normalizeChampionName(p.championName),
      win: !!p.win,
      kills: p.kills ?? 0,
      deaths: p.deaths ?? 0,
      assists: p.assists ?? 0,
      items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter((i) => i > 0),
      keystone: p.perks?.styles?.[0]?.selections?.[0]?.perk ?? null,
      role: p.teamPosition || '',
      cs: (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0),
      durationSec,
      endedAt: info.gameEndTimestamp ?? (info.gameCreation ?? 0) + durationSec * 1000,
    });
  }
  games.sort((a, b) => b.endedAt - a.endedAt);

  const byChampion = new Map();
  for (const g of games) {
    const s = byChampion.get(g.championId) ?? { championId: g.championId, games: 0, wins: 0, kills: 0, deaths: 0, assists: 0, items: [], keystones: [] };
    s.games += 1;
    s.wins += g.win ? 1 : 0;
    s.kills += g.kills;
    s.deaths += g.deaths;
    s.assists += g.assists;
    s.items.push(...g.items);
    if (g.keystone) s.keystones.push(g.keystone);
    byChampion.set(g.championId, s);
  }

  const champions = [...byChampion.values()]
    .map(({ items, keystones, ...s }) => ({
      ...s,
      topItems: mostCommon(items).slice(0, 6).map(([id]) => id),
      keystone: mostCommon(keystones)[0]?.[0] ?? null,
    }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.championId.localeCompare(b.championId))
    .slice(0, 8);

  // Partite e campioni per ruolo (ruoli dell'app): servono a scegliere ruolo e pick quando si compila la sessione
  const byRole = new Map();
  for (const g of games) {
    const role = APP_ROLES[g.role];
    if (!role) continue;
    const entry = byRole.get(role) ?? { role, games: 0, champs: new Map() };
    entry.games += 1;
    entry.champs.set(g.championId, (entry.champs.get(g.championId) ?? 0) + 1);
    byRole.set(role, entry);
  }
  const roles = [...byRole.values()]
    .map(({ role, games: n, champs }) => ({
      role,
      games: n,
      champions: [...champs.entries()]
        .map(([championId, count]) => ({ championId, games: count }))
        .sort((a, b) => b.games - a.games || a.championId.localeCompare(b.championId)),
    }))
    .sort((a, b) => b.games - a.games || a.role.localeCompare(b.role));

  return { recent: games.slice(0, 10), champions, roles, gamesAnalyzed: games.length };
}

function summarizeRanks(entries) {
  return (Array.isArray(entries) ? entries : [])
    .filter((e) => QUEUE_KEYS[e.queueType])
    .map((e) => ({
      queue: QUEUE_KEYS[e.queueType],
      tier: e.tier,
      rank: e.rank,
      lp: e.leaguePoints ?? 0,
      wins: e.wins ?? 0,
      losses: e.losses ?? 0,
    }))
    .sort((a, b) => (a.queue === 'solo' ? -1 : 1) - (b.queue === 'solo' ? -1 : 1));
}

// Maestria per campione (Champion-Mastery-V4): livello, punti e ultima partita, dai più ai meno alti.
// keyMap: { '222': 'Jinx' } da Data Dragon; le voci con una chiave sconosciuta vengono saltate.
function summarizeMastery(entries, keyMap = {}, limit = 20) {
  return (Array.isArray(entries) ? entries : [])
    .filter((e) => keyMap[String(e.championId)])
    .map((e) => ({
      championId: keyMap[String(e.championId)],
      level: e.championLevel ?? 0,
      points: e.championPoints ?? 0,
      lastPlayedAt: e.lastPlayTime ?? null,
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

// Esegue fn su tutti gli elementi, al massimo `limit` alla volta, mantenendo l'ordine
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Client minimale per la Riot API, con cache in memoria: la chiave resta sul backend e le chiamate
// ripetute per lo stesso giocatore non consumano il limite di richieste
function createRiotService({
  apiKey,
  fetchFn = fetch,
  ttlMs = 30 * 60 * 1000,
  now = () => Date.now(),
  matchCount = 15,
  concurrency = 4,
  // async () => ({ '222': 'Jinx' }): id numerici di Riot -> id di Data Dragon, per le maestrie
  championKeys = async () => ({}),
}) {
  const cache = new Map();
  const inflight = new Map();
  // Il puuid di un Riot ID non cambia: si ricorda a lungo e si risparmia una chiamata a ogni aggiornamento
  const puuids = new Map();

  async function get(url) {
    const res = await fetchFn(url, { headers: { 'X-Riot-Token': apiKey } });
    if (res.ok) return res.json();
    if (res.status === 404) throw new RiotError(404, 'Non trovato');
    if (res.status === 429) {
      const retryAfter = Number(res.headers?.get?.('retry-after')) || undefined;
      throw new RiotError(429, 'Troppe richieste a Riot: riprova tra poco', retryAfter);
    }
    if (res.status === 401 || res.status === 403) throw new RiotError(502, 'Chiave Riot non valida o scaduta');
    throw new RiotError(502, `Errore dal servizio Riot (${res.status})`);
  }

  async function load(riotId, region) {
    const route = ROUTING[region];
    if (!route) throw new RiotError(400, 'Regione non supportata');
    if (!RIOT_ID_REGEX.test(riotId)) throw new RiotError(400, 'Riot ID non valido');
    const hash = riotId.lastIndexOf('#');
    const gameName = riotId.slice(0, hash);
    const tagLine = riotId.slice(hash + 1);

    const puuidKey = `${region}:${riotId.toLowerCase()}`;
    let puuid = puuids.get(puuidKey);
    if (!puuid) {
      try {
        const account = await get(
          `https://${route.account}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
        );
        puuid = account.puuid;
        puuids.set(puuidKey, puuid);
      } catch (e) {
        if (e.status === 404) throw new RiotError(404, 'Giocatore non trovato su Riot: controlla Riot ID e regione');
        throw e;
      }
    }

    const [entries, ids, masteryEntries] = await Promise.all([
      // Il rank è un extra: se manca non blocca il resto
      get(`https://${route.platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`).catch((e) => {
        if (e.status === 429) throw e;
        return [];
      }),
      get(`https://${route.match}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${matchCount}`),
      // Anche le maestrie sono un extra: se mancano, il profilo resta valido
      get(`https://${route.platform}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`).catch((e) => {
        if (e.status === 429) throw e;
        return [];
      }),
    ]);

    const matches = await mapLimit(ids, concurrency, (id) =>
      get(`https://${route.match}.api.riotgames.com/lol/match/v5/matches/${id}`).catch((e) => {
        if (e.status === 429) throw e;
        return null;
      }),
    );

    return {
      riotId,
      region,
      ranks: summarizeRanks(entries),
      mastery: summarizeMastery(masteryEntries, await championKeys().catch(() => ({}))),
      ...summarizeMatches(puuid, matches.filter(Boolean)),
      updatedAt: new Date(now()).toISOString(),
    };
  }

  async function getProfile(riotId, region) {
    const key = `${region}:${riotId.toLowerCase()}`;
    const hit = cache.get(key);
    if (hit && now() - hit.at < ttlMs) return hit.value;
    if (inflight.has(key)) return inflight.get(key);
    const promise = load(riotId, region)
      .then((value) => {
        cache.set(key, { at: now(), value });
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }

  return { getProfile };
}

module.exports = { ROUTING, RiotError, createRiotService, summarizeMatches, summarizeRanks, summarizeMastery, normalizeChampionName };
