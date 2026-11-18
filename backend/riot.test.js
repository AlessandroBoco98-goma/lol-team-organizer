const test = require('node:test');
const assert = require('node:assert/strict');
const { ROUTING, RiotError, createRiotService, summarizeMatches, summarizeRanks, normalizeChampionName } = require('./riot');

const PUUID = 'my-puuid';

// Partita Match-V5 minima con il giocatore indicato
const match = (id, p, info = {}) => ({
  metadata: { matchId: id },
  info: {
    gameMode: 'CLASSIC',
    gameDuration: 1800,
    gameEndTimestamp: Number(id.replace(/\D/g, '')) * 1000,
    participants: [
      { puuid: 'other', championName: 'Zed', win: false, kills: 1, deaths: 1, assists: 1 },
      {
        puuid: PUUID,
        championName: 'Jinx',
        win: true,
        kills: 5,
        deaths: 2,
        assists: 7,
        item0: 3031,
        item1: 3006,
        item2: 0,
        item3: 3094,
        item4: 0,
        item5: 0,
        totalMinionsKilled: 200,
        neutralMinionsKilled: 10,
        teamPosition: 'BOTTOM',
        perks: { styles: [{ selections: [{ perk: 8008 }] }] },
        ...p,
      },
    ],
    ...info,
  },
});

test('ROUTING: ogni regione supportata ha piattaforma e cluster', () => {
  for (const r of ['EUW', 'EUNE', 'NA', 'KR', 'BR', 'LAN', 'LAS', 'OCE', 'TR', 'RU', 'JP']) {
    assert.ok(ROUTING[r]?.platform && ROUTING[r]?.match && ROUTING[r]?.account, r);
  }
  assert.equal(ROUTING.OCE.match, 'sea');
  assert.notEqual(ROUTING.OCE.account, 'sea'); // l'Account-V1 non supporta "sea"
});

test('normalizeChampionName: corregge FiddleSticks', () => {
  assert.equal(normalizeChampionName('FiddleSticks'), 'Fiddlesticks');
  assert.equal(normalizeChampionName('Jinx'), 'Jinx');
});

test('summarizeMatches: ultime partite ordinate dalla più recente, solo Summoner\'s Rift', () => {
  const r = summarizeMatches(PUUID, [
    match('EUW1_100', {}),
    match('EUW1_300', { championName: 'Ashe', win: false }),
    match('EUW1_200', {}, { gameMode: 'ARAM' }),
  ]);
  assert.equal(r.gamesAnalyzed, 2);
  assert.deepEqual(r.recent.map((g) => g.matchId), ['EUW1_300', 'EUW1_100']);
  assert.equal(r.recent[0].championId, 'Ashe');
  assert.equal(r.recent[1].cs, 210);
  assert.deepEqual(r.recent[1].items, [3031, 3006, 3094]);
  assert.equal(r.recent[1].keystone, 8008);
});

test('summarizeMatches: statistiche per campione con build e keystone più frequenti', () => {
  const r = summarizeMatches(PUUID, [
    match('EUW1_1', {}),
    match('EUW1_2', { item0: 3031, item1: 3006, item3: 3087, win: false, kills: 1, deaths: 4, assists: 2 }),
    match('EUW1_3', { championName: 'Ashe' }),
  ]);
  const jinx = r.champions.find((c) => c.championId === 'Jinx');
  assert.equal(jinx.games, 2);
  assert.equal(jinx.wins, 1);
  assert.equal(jinx.kills, 6);
  assert.equal(jinx.deaths, 6);
  assert.equal(jinx.assists, 9);
  assert.deepEqual(jinx.topItems.slice(0, 2), [3006, 3031]); // a parità di conteggio, id crescente
  assert.equal(jinx.keystone, 8008);
  assert.equal(r.champions[0].championId, 'Jinx'); // il più giocato per primo
});

test('summarizeMatches: ignora partite senza il giocatore o malformate e gestisce durate in millisecondi', () => {
  const r = summarizeMatches(PUUID, [null, {}, { info: { gameMode: 'CLASSIC', participants: [] } }, match('EUW1_5', {}, { gameDuration: 1800000 })]);
  assert.equal(r.gamesAnalyzed, 1);
  assert.equal(r.recent[0].durationSec, 1800);
});

test('summarizeRanks: solo e flex, solo prima; altre code ignorate', () => {
  const r = summarizeRanks([
    { queueType: 'RANKED_FLEX_SR', tier: 'SILVER', rank: 'I', leaguePoints: 10, wins: 3, losses: 2 },
    { queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'II', leaguePoints: 55, wins: 40, losses: 35 },
    { queueType: 'CHERRY', tier: 'X' },
  ]);
  assert.deepEqual(r.map((x) => x.queue), ['solo', 'flex']);
  assert.deepEqual(r[0], { queue: 'solo', tier: 'GOLD', rank: 'II', lp: 55, wins: 40, losses: 35 });
  assert.deepEqual(summarizeRanks(null), []);
});

// Falso fetch: mappa URL -> risposta
function fakeFetch(routes, calls = []) {
  return async (url, options) => {
    calls.push({ url, options });
    const key = Object.keys(routes).find((k) => url.includes(k));
    const r = key ? routes[key] : { status: 404 };
    return {
      ok: !r.status || r.status < 400,
      status: r.status ?? 200,
      headers: { get: (h) => (r.headers ?? {})[h.toLowerCase()] ?? null },
      json: async () => r.body,
    };
  };
}

const happyRoutes = () => ({
  'by-riot-id/Faker/KR1': { body: { puuid: PUUID } },
  'league/v4/entries/by-puuid': { body: [{ queueType: 'RANKED_SOLO_5x5', tier: 'GOLD', rank: 'IV', leaguePoints: 1, wins: 1, losses: 1 }] },
  'matches/by-puuid': { body: ['EUW1_1', 'EUW1_2'] },
  'matches/EUW1_1': { body: match('EUW1_1', {}) },
  'matches/EUW1_2': { body: match('EUW1_2', { championName: 'Ashe' }) },
});

test('getProfile: costruisce il profilo, usa il cluster giusto e invia la chiave', async () => {
  const calls = [];
  const svc = createRiotService({ apiKey: 'KEY', fetchFn: fakeFetch(happyRoutes(), calls), now: () => 1_000_000 });
  const p = await svc.getProfile('Faker#KR1', 'EUW');
  assert.equal(p.ranks[0].tier, 'GOLD');
  assert.equal(p.gamesAnalyzed, 2);
  assert.equal(p.updatedAt, new Date(1_000_000).toISOString());
  assert.ok(calls.every((c) => c.options.headers['X-Riot-Token'] === 'KEY'));
  assert.ok(calls[0].url.startsWith('https://europe.api.riotgames.com/riot/account/v1/'));
  assert.ok(calls.some((c) => c.url.startsWith('https://euw1.api.riotgames.com/lol/league/v4/')));
  assert.ok(calls.every((c) => !c.url.includes('undefined')));
});

test('getProfile: codifica nome e tag nell\'URL', async () => {
  const calls = [];
  const routes = { ...happyRoutes(), 'by-riot-id/Hide%20on%20bush/KR1': { body: { puuid: PUUID } } };
  const svc = createRiotService({ apiKey: 'K', fetchFn: fakeFetch(routes, calls) });
  await svc.getProfile('Hide on bush#KR1', 'KR');
  assert.ok(calls[0].url.includes('/Hide%20on%20bush/KR1'));
  assert.ok(calls[0].url.startsWith('https://asia.'));
});

test('getProfile: cache, nessuna nuova chiamata entro il TTL e nuova dopo', async () => {
  const calls = [];
  let t = 0;
  const svc = createRiotService({ apiKey: 'K', fetchFn: fakeFetch(happyRoutes(), calls), ttlMs: 1000, now: () => t });
  await svc.getProfile('Faker#KR1', 'EUW');
  const first = calls.length;
  t = 500;
  await svc.getProfile('faker#kr1', 'EUW'); // stessa chiave, senza distinguere maiuscole
  assert.equal(calls.length, first);
  t = 2000;
  await svc.getProfile('Faker#KR1', 'EUW');
  assert.ok(calls.length > first);
});

test('getProfile: richieste simultanee dello stesso giocatore condividono la stessa chiamata', async () => {
  const calls = [];
  const svc = createRiotService({ apiKey: 'K', fetchFn: fakeFetch(happyRoutes(), calls) });
  await Promise.all([svc.getProfile('Faker#KR1', 'EUW'), svc.getProfile('Faker#KR1', 'EUW')]);
  assert.equal(calls.filter((c) => c.url.includes('by-riot-id')).length, 1);
});

test('getProfile: errori chiari per giocatore non trovato, chiave non valida, limite e dati non validi', async () => {
  const mk = (routes) => createRiotService({ apiKey: 'K', fetchFn: fakeFetch(routes) });
  await assert.rejects(mk({}).getProfile('Faker#KR1', 'EUW'), (e) => e instanceof RiotError && e.status === 404);
  await assert.rejects(mk({ 'by-riot-id': { status: 403 } }).getProfile('Faker#KR1', 'EUW'), (e) => e.status === 502 && /chiave/i.test(e.message));
  await assert.rejects(
    mk({ 'by-riot-id': { status: 429, headers: { 'retry-after': '30' } } }).getProfile('Faker#KR1', 'EUW'),
    (e) => e.status === 429 && e.retryAfter === 30,
  );
  await assert.rejects(mk(happyRoutes()).getProfile('Faker', 'EUW'), (e) => e.status === 400);
  await assert.rejects(mk(happyRoutes()).getProfile('Faker#KR1', 'XX'), (e) => e.status === 400);
});

test('getProfile: il rank mancante o una partita che fallisce non bloccano il profilo', async () => {
  const routes = { ...happyRoutes(), 'league/v4/entries/by-puuid': { status: 500 }, 'matches/EUW1_2': { status: 500 } };
  const p = await createRiotService({ apiKey: 'K', fetchFn: fakeFetch(routes) }).getProfile('Faker#KR1', 'EUW');
  assert.deepEqual(p.ranks, []);
  assert.equal(p.gamesAnalyzed, 1);
});

test('getProfile: il limite di richieste durante le partite viene propagato', async () => {
  const routes = { ...happyRoutes(), 'matches/EUW1_2': { status: 429 } };
  await assert.rejects(createRiotService({ apiKey: 'K', fetchFn: fakeFetch(routes) }).getProfile('Faker#KR1', 'EUW'), (e) => e.status === 429);
});
