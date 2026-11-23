const test = require('node:test');
const assert = require('node:assert/strict');
const { assignRoles, pickChampions, planComposition, gamesByRole } = require('./autofill');

// Profilo Riot minimo: ruoli con partite e campioni
const profile = (roles, champions = []) => ({
  roles: roles.map(([role, games, champs = []]) => ({ role, games, champions: champs.map(([championId, g]) => ({ championId, games: g })) })),
  champions: champions.map(([championId, games]) => ({ championId, games })),
});

test('assignRoles: ognuno prende il ruolo che gioca di più', () => {
  const r = assignRoles([
    { playerId: 'a', games: { ADC: 9, MID: 1 } },
    { playerId: 'b', games: { SUPPORT: 7 } },
    { playerId: 'c', games: { JUNGLE: 5, TOP: 1 } },
  ]);
  assert.deepEqual(r, { a: 'ADC', b: 'SUPPORT', c: 'JUNGLE' });
});

test('assignRoles: se due vogliono lo stesso ruolo, vince la combinazione migliore per tutti', () => {
  // a e b giocano soprattutto ADC; b è molto più forte lì, a ha una buona alternativa in MID
  const r = assignRoles([
    { playerId: 'a', games: { ADC: 6, MID: 5 } },
    { playerId: 'b', games: { ADC: 10, MID: 0 } },
  ]);
  assert.deepEqual(r, { a: 'MID', b: 'ADC' });
});

test('assignRoles: chi non ha dati prende i ruoli che restano, in ordine', () => {
  const r = assignRoles([
    { playerId: 'a', games: { TOP: 4 } },
    { playerId: 'b', games: {} },
    { playerId: 'c', games: {} },
  ]);
  assert.equal(r.a, 'TOP');
  assert.deepEqual([r.b, r.c], ['JUNGLE', 'MID']);
});

test('assignRoles: i ruoli bloccati non vengono usati e i ruoli sono sempre diversi', () => {
  const r = assignRoles(
    [
      { playerId: 'a', games: { TOP: 9 } },
      { playerId: 'b', games: { TOP: 9 } },
    ],
    ['TOP'],
  );
  assert.notEqual(r.a, 'TOP');
  assert.notEqual(r.b, 'TOP');
  assert.notEqual(r.a, r.b);
});

test('assignRoles: con 5 giocatori assegna tutti e 5 i ruoli', () => {
  const players = ['a', 'b', 'c', 'd', 'e'].map((playerId) => ({ playerId, games: { MID: 3 } }));
  const r = assignRoles(players);
  assert.equal(new Set(Object.values(r)).size, 5);
});

test('assignRoles: errore se i giocatori sono più dei ruoli liberi', () => {
  const three = ['a', 'b', 'c'].map((playerId) => ({ playerId, games: {} }));
  assert.throws(() => assignRoles(three, ['TOP', 'JUNGLE', 'MID']));
});

test('pickChampions: prima i più giocati nel ruolo, poi i più giocati in assoluto, senza doppioni, al massimo 3', () => {
  const p = profile([['ADC', 6, [['Jinx', 4], ['Ashe', 2]]]], [['Jinx', 5], ['Lulu', 3], ['Ahri', 2]]);
  assert.deepEqual(pickChampions(p, 'ADC'), ['Jinx', 'Ashe', 'Lulu']);
});

test('pickChampions: senza dati nel ruolo usa i campioni in assoluto; senza profilo è vuoto', () => {
  const p = profile([['MID', 2, [['Ahri', 2]]]], [['Jinx', 5], ['Ashe', 4]]);
  assert.deepEqual(pickChampions(p, 'ADC'), ['Jinx', 'Ashe']);
  assert.deepEqual(pickChampions(undefined, 'ADC'), []);
  assert.deepEqual(gamesByRole(undefined), {});
});

const voters = [
  { id: 'p1', name: 'Boco', riotId: 'Boco#EUW', region: 'EUW' },
  { id: 'p2', name: 'Carre' },
  { id: 'p3', name: 'Fraboco', riotId: 'Fra#EUW', region: 'EUW' },
];

test('planComposition: ruoli e pick dai profili, giocatori in ordine di ruolo', () => {
  const profiles = {
    p1: profile([['ADC', 8, [['Jinx', 5], ['Vayne', 3]]]], [['Jinx', 5], ['Vayne', 3]]),
    p3: profile([['MID', 6, [['Ahri', 4]]]], [['Ahri', 4]]),
  };
  const { players, withoutData } = planComposition({ voters, profiles, nameOf: (id) => `N-${id}` });
  // Boco gioca ADC, Fraboco MID; Carre, senza dati, prende un ruolo che resta (Top). Ordine finale: Top, Mid, ADC.
  assert.deepEqual(players.map((p) => p.name), ['Carre', 'Fraboco', 'Boco']);
  const boco = players.find((p) => p.name === 'Boco');
  assert.equal(boco.role, 'ADC');
  assert.equal(players.find((p) => p.name === 'Fraboco').role, 'MID');
  assert.deepEqual(boco.champions, [{ id: 'Jinx', name: 'N-Jinx' }, { id: 'Vayne', name: 'N-Vayne' }]);
  assert.equal(boco.riotId, 'Boco#EUW');
  assert.deepEqual(withoutData, ['Carre']);
  assert.equal(new Set(players.map((p) => p.role)).size, 3);
});

test('planComposition: senza nessun profilo i giocatori entrano comunque, con ruoli diversi e senza campioni', () => {
  const { players, withoutData } = planComposition({ voters });
  assert.equal(players.length, 3);
  assert.equal(new Set(players.map((p) => p.role)).size, 3);
  assert.ok(players.every((p) => p.champions.length === 0));
  assert.deepEqual(withoutData.sort(), ['Boco', 'Carre', 'Fraboco']);
});

test('planComposition: chi era già in sessione e ha votato sì resta com\'è, chi non ha votato sì esce', () => {
  const existing = [
    { playerId: 'p1', name: 'Boco', role: 'SUPPORT', champions: [{ id: 'Lulu', name: 'Lulu' }] }, // scelto a mano
    { playerId: 'p9', name: 'Assente', role: 'TOP', champions: [] }, // non ha votato sì
  ];
  const profiles = { p1: profile([['ADC', 8, [['Jinx', 8]]]]), p3: profile([['SUPPORT', 9, [['Thresh', 9]]]]) };
  const { players } = planComposition({ voters, existing, profiles });
  assert.ok(!players.some((p) => p.name === 'Assente'));
  const boco = players.find((p) => p.name === 'Boco');
  assert.equal(boco.role, 'SUPPORT'); // la scelta a mano non cambia
  assert.deepEqual(boco.champions, [{ id: 'Lulu', name: 'Lulu' }]);
  // il ruolo di Boco è occupato: Fraboco, che gioca Support, ne prende un altro
  assert.notEqual(players.find((p) => p.name === 'Fraboco').role, 'SUPPORT');
});

test('planComposition: il nome viene aggiornato a quello attuale del roster', () => {
  const existing = [{ playerId: 'p2', name: 'Vecchio nome', role: 'TOP', champions: [] }];
  const { players } = planComposition({ voters, existing });
  assert.equal(players.find((p) => p.playerId === 'p2').name, 'Carre');
});

test('planComposition: errore se hanno confermato più di 5', () => {
  const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, name: id }));
  assert.throws(() => planComposition({ voters: six }));
});
