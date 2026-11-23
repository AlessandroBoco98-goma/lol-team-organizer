const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTraits, createTraitsService } = require('./traits');

const jinxDD = { id: 'Jinx', key: '222', tags: ['Marksman'], info: { attack: 9, defense: 2, magic: 4, difficulty: 6 } };
const jinxCD = { playstyleInfo: { damage: 3, durability: 1, crowdControl: 2, mobility: 1, utility: 1 }, tacticalInfo: { damageType: 'kPhysical' } };

test('buildTraits: usa Community Dragon per i numeri e Meraki per i ruoli', () => {
  const t = buildTraits(jinxDD, jinxCD, { positions: ['BOTTOM'] });
  assert.deepEqual(t, { damage: 3, durability: 1, crowdControl: 2, mobility: 1, utility: 1, damageType: 'physical', positions: ['ADC'], source: 'communitydragon' });
});

test('buildTraits: converte i ruoli di Meraki in ruoli dell\'app, senza doppioni', () => {
  const t = buildTraits(jinxDD, jinxCD, { positions: ['MIDDLE', 'TOP', 'UTILITY', 'SUPPORT'] });
  assert.deepEqual(t.positions, ['MID', 'TOP', 'SUPPORT']);
});

test('buildTraits: senza Meraki i ruoli sono sconosciuti (null), non vuoti', () => {
  assert.equal(buildTraits(jinxDD, jinxCD, undefined).positions, null);
  assert.equal(buildTraits(jinxDD, jinxCD, { positions: [] }).positions, null);
});

test('buildTraits: senza Community Dragon ripiega su Data Dragon', () => {
  const t = buildTraits({ id: 'Garen', key: '86', tags: ['Fighter', 'Tank'], info: { attack: 7, defense: 7, magic: 1, difficulty: 5 } }, null, null);
  assert.equal(t.source, 'datadragon');
  assert.equal(t.damageType, 'physical');
  assert.equal(t.durability, 3); // Tank
  assert.equal(t.positions, null);
});

test('buildTraits: dati Data Dragon tutti a 0 danno "mixed" e valori neutri', () => {
  const t = buildTraits({ id: 'Vex', key: '711', tags: ['Mage'], info: { attack: 0, defense: 0, magic: 0, difficulty: 0 } }, null, null);
  assert.equal(t.damageType, 'mixed');
  assert.ok(t.damage >= 1);
});

// Fetch finto: mappa URL -> JSON (o errore)
function fakeFetch(routes) {
  return async (url) => {
    const key = Object.keys(routes).find((k) => url.includes(k));
    const body = key ? routes[key] : undefined;
    if (body === undefined) return { ok: false, status: 404, json: async () => null };
    if (body instanceof Error) throw body;
    return { ok: true, status: 200, json: async () => body };
  };
}

test('createTraitsService: carica tutti i campioni e li unisce alle fonti', async () => {
  const svc = createTraitsService({
    listChampions: async () => [jinxDD, { id: 'Lulu', key: '117', tags: ['Support', 'Mage'], info: { attack: 4, defense: 5, magic: 7, difficulty: 5 } }],
    fetchFn: fakeFetch({
      '/champions/222.json': jinxCD,
      '/champions/117.json': { playstyleInfo: { damage: 2, durability: 1, crowdControl: 2, mobility: 1, utility: 3 }, tacticalInfo: { damageType: 'kMagic' } },
      'champions.json': { Jinx: { id: 222, positions: ['BOTTOM'] }, Lulu: { id: 117, positions: ['SUPPORT'] } },
    }),
  });
  const traits = await svc.getTraits();
  assert.deepEqual(Object.keys(traits).sort(), ['Jinx', 'Lulu']);
  assert.equal(traits.Lulu.utility, 3);
  assert.deepEqual(traits.Lulu.positions, ['SUPPORT']);
  assert.deepEqual(traits.Jinx.positions, ['ADC']);
});

test('createTraitsService: se una fonte non risponde i campioni restano disponibili con il ripiego', async () => {
  const svc = createTraitsService({
    listChampions: async () => [jinxDD],
    fetchFn: fakeFetch({ 'champions.json': new Error('rete'), '/champions/222.json': new Error('rete') }),
  });
  const traits = await svc.getTraits();
  assert.equal(traits.Jinx.source, 'datadragon');
  assert.equal(traits.Jinx.positions, null);
});

test('createTraitsService: cache e caricamento condiviso', async () => {
  let calls = 0;
  let t = 0;
  const svc = createTraitsService({
    listChampions: async () => {
      calls += 1;
      return [jinxDD];
    },
    fetchFn: fakeFetch({ '/champions/222.json': jinxCD }),
    ttlMs: 1000,
    now: () => t,
  });
  await Promise.all([svc.getTraits(), svc.getTraits()]);
  assert.equal(calls, 1);
  t = 500;
  await svc.getTraits();
  assert.equal(calls, 1);
  t = 2000;
  await svc.getTraits();
  assert.equal(calls, 2);
});
