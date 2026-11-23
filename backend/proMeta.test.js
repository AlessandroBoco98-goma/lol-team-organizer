const test = require('node:test');
const assert = require('node:assert/strict');
const { ROLE_MAP, metaScore, createProMetaService: makeService } = require('./proMeta');

// Nei test i nuovi tentativi partono subito
const createProMetaService = (options) => makeService({ retryDelayMs: 0, ...options });

test('ROLE_MAP: i ruoli di Leaguepedia diventano quelli dell\'app (Bot = ADC)', () => {
  assert.deepEqual(ROLE_MAP, { Top: 'TOP', Jungle: 'JUNGLE', Mid: 'MID', Bot: 'ADC', Support: 'SUPPORT' });
});

test('metaScore: sale con la presenza e con le vittorie', () => {
  const total = 100;
  const high = metaScore({ games: 30, wins: 18, total });
  const mid = metaScore({ games: 10, wins: 5, total });
  const low = metaScore({ games: 1, wins: 0, total });
  assert.ok(high > mid && mid > low);
  assert.ok(high <= 1 && low >= 0);
});

test('metaScore: un pick rate del 25% o più vale il massimo della presenza', () => {
  assert.ok(Math.abs(metaScore({ games: 25, wins: 10, total: 100 }) - metaScore({ games: 60, wins: 24, total: 100 })) < 1e-9);
});

test('metaScore: sotto le 8 partite il winrate è neutro, non punisce né premia', () => {
  const lucky = metaScore({ games: 5, wins: 5, total: 100 });
  const unlucky = metaScore({ games: 5, wins: 0, total: 100 });
  assert.equal(lucky, unlucky);
});

test('metaScore: senza partite totali è 0 di presenza', () => {
  assert.ok(metaScore({ games: 0, wins: 0, total: 0 }) <= 0.35 * 0.5 + 1e-9);
});

const NOW = Date.parse('2026-11-23T12:00:00Z');

// Fetch finto di Cargo: riconosce la richiesta dal contenuto dei parametri
function cargoFetch({ tournaments, total, champs, calls = [], failFirst = 0 }) {
  let failed = 0;
  return async (url) => {
    calls.push(url);
    const params = new URL(url).searchParams;
    if (failed < failFirst) {
      failed += 1;
      return { ok: false, status: 503, json: async () => ({}) };
    }
    const fields = params.get('fields');
    let body;
    if (params.get('tables').startsWith('Tournaments')) body = tournaments;
    else if (fields.includes('COUNT(DISTINCT')) body = total;
    else body = champs;
    return { ok: true, status: 200, json: async () => ({ cargoquery: (body ?? []).map((title) => ({ title })) }) };
  };
}

const sample = () => ({
  tournaments: [{ OverviewPage: 'Worlds 2026 Main Event', Name: 'Worlds 2026 Main Event' }, { OverviewPage: "Player's Cup", Name: "Player's Cup" }],
  total: [{ Games: '100' }],
  champs: [
    { Champion: 'Ezreal', Role: 'Bot', Games: '30', Wins: '15' },
    { Champion: 'Lee Sin', Role: 'Jungle', Games: '20', Wins: '12' },
    { Champion: 'Wukong', Role: 'Top', Games: '4', Wins: '1' },
    { Champion: 'Sconosciuto', Role: 'Mid', Games: '9', Wins: '5' }, // non in Data Dragon: saltato
    { Champion: 'Ezreal', Role: 'Mid', Games: '3', Wins: '1' }, // ruolo secondario dello stesso campione
    { Champion: 'Karma', Role: 'Coach', Games: '2', Wins: '1' }, // ruolo non valido: saltato
  ],
});

const nameToId = async () => ({ Ezreal: 'Ezreal', 'Lee Sin': 'LeeSin', Wukong: 'MonkeyKing', Karma: 'Karma' });

test('getMeta: pick rate, winrate e punteggio per campione e ruolo, con gli id di Data Dragon', async () => {
  const svc = createProMetaService({ fetchFn: cargoFetch(sample()), nameToId, now: () => NOW });
  const meta = await svc.getMeta();
  assert.equal(meta.games, 100);
  assert.equal(meta.windowDays, 45);
  assert.equal(meta.source, 'Leaguepedia');
  assert.match(meta.license, /CC BY-SA/);
  assert.deepEqual(Object.keys(meta.champions).sort(), ['Ezreal', 'LeeSin', 'MonkeyKing']);
  assert.equal(meta.champions.Ezreal.ADC.games, 30);
  assert.equal(meta.champions.Ezreal.ADC.pickRate, 0.3);
  assert.equal(meta.champions.Ezreal.ADC.winRate, 0.5);
  assert.ok(meta.champions.Ezreal.MID, 'lo stesso campione può avere più ruoli');
  assert.ok(meta.champions.Ezreal.ADC.score > meta.champions.Ezreal.MID.score);
  assert.ok(meta.champions.LeeSin.JUNGLE.score > meta.champions.MonkeyKing.TOP.score);
  assert.deepEqual(meta.tournaments, ['Worlds 2026 Main Event', "Player's Cup"]);
});

test('getMeta: le richieste usano una finestra di date e solo i tornei principali, con le virgolette protette', async () => {
  const calls = [];
  await createProMetaService({ fetchFn: cargoFetch({ ...sample(), calls }), nameToId, now: () => NOW }).getMeta();
  const decoded = calls.map((u) => decodeURIComponent(u.replace(/\+/g, ' ')));
  assert.ok(decoded[0].includes("TournamentLevel='Primary'"));
  const agg = decoded.find((u) => u.includes('GROUP BY') || u.includes('group_by'));
  assert.ok(agg.includes("2026-10-09 12:00:00"), 'inizio finestra 45 giorni prima');
  assert.ok(agg.includes("IN ('Worlds 2026 Main Event','Player\\'s Cup')"), 'apostrofo protetto');
  assert.ok(calls.every((u) => u.startsWith('https://lol.fandom.com/api.php?')));
});

test('getMeta: se nei 45 giorni ci sono troppe poche partite allarga la finestra a 120', async () => {
  let call = 0;
  const base = cargoFetch(sample());
  const fetchFn = async (url) => {
    const p = new URL(url).searchParams;
    if (p.get('fields')?.includes('COUNT(DISTINCT')) {
      call += 1;
      // prima finestra: poche partite; seconda: abbastanza
      return { ok: true, json: async () => ({ cargoquery: [{ title: { Games: call === 1 ? '12' : '100' } }] }) };
    }
    return base(url);
  };
  const meta = await createProMetaService({ fetchFn, nameToId, now: () => NOW }).getMeta();
  assert.equal(meta.windowDays, 120);
});

test('getMeta: null se non ci sono tornei, dati insufficienti o la fonte non risponde', async () => {
  const noTournaments = createProMetaService({ fetchFn: cargoFetch({ ...sample(), tournaments: [] }), nameToId, now: () => NOW });
  assert.equal(await noTournaments.getMeta(), null);

  const few = createProMetaService({ fetchFn: cargoFetch({ ...sample(), total: [{ Games: '5' }] }), nameToId, now: () => NOW });
  assert.equal(await few.getMeta(), null);

  const down = createProMetaService({ fetchFn: async () => ({ ok: false, status: 503, json: async () => ({}) }), nameToId, now: () => NOW });
  assert.equal(await down.getMeta(), null);

  const throws = createProMetaService({
    fetchFn: async () => {
      throw new Error('rete');
    },
    nameToId,
    now: () => NOW,
  });
  assert.equal(await throws.getMeta(), null);
});

test('getMeta: un 503 passeggero viene ritentato', async () => {
  const calls = [];
  const svc = createProMetaService({ fetchFn: cargoFetch({ ...sample(), calls, failFirst: 1 }), nameToId, now: () => NOW });
  const meta = await svc.getMeta();
  assert.ok(meta, 'dopo un nuovo tentativo i dati arrivano');
  assert.ok(calls.length >= 4);
});

test('getMeta: cache e richieste in parallelo condivise', async () => {
  const calls = [];
  let t = NOW;
  const svc = createProMetaService({ fetchFn: cargoFetch({ ...sample(), calls }), nameToId, now: () => t, ttlMs: 1000 });
  await Promise.all([svc.getMeta(), svc.getMeta()]);
  const first = calls.length;
  assert.ok(first <= 3, 'una sola serie di richieste');
  t = NOW + 500;
  await svc.getMeta();
  assert.equal(calls.length, first);
  t = NOW + 5000;
  await svc.getMeta();
  assert.ok(calls.length > first);
});
