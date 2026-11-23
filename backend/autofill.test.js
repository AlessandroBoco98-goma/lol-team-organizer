const test = require('node:test');
const assert = require('node:assert/strict');
const { assignRoles, pickChampions, planComposition, gamesByRole, roleTakenBy, applyVote } = require('./autofill');

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

test('pickChampions: dopo il ruolo giocato vengono i campioni con più maestria, poi gli altri', () => {
  const p = {
    roles: [{ role: 'ADC', games: 3, champions: [{ championId: 'Jinx', games: 3 }] }],
    champions: [{ championId: 'Lulu', games: 5 }],
    mastery: [{ championId: 'Ashe', points: 80000, level: 6 }, { championId: 'Vayne', points: 300000, level: 9 }],
  };
  assert.deepEqual(pickChampions(p, 'ADC'), ['Jinx', 'Vayne', 'Ashe']); // maestria più alta per prima
});

test('pickChampions: la maestria è filtrata per ruolo quando i ruoli del campione sono noti', () => {
  const p = {
    roles: [],
    champions: [{ championId: 'Lulu', games: 5 }],
    mastery: [{ championId: 'Garen', points: 900000 }, { championId: 'Ashe', points: 80000 }, { championId: 'Jinx', points: 50000 }],
  };
  const traits = { Garen: { positions: ['TOP'] }, Ashe: { positions: ['ADC', 'SUPPORT'] }, Jinx: { positions: ['ADC'] } };
  assert.deepEqual(pickChampions(p, 'ADC', 3, traits), ['Ashe', 'Jinx', 'Lulu']); // Garen non è un ADC
});

test('pickChampions: con ruoli sconosciuti (positions null) o campione senza tratti la maestria vale per ogni ruolo', () => {
  const p = { mastery: [{ championId: 'Nuovo', points: 100 }, { championId: 'Ignoto', points: 50 }] };
  assert.deepEqual(pickChampions(p, 'MID', 3, { Nuovo: { positions: null } }), ['Nuovo', 'Ignoto']);
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

test('planComposition: usa maestria e tratti per scegliere i pick nel ruolo votato', () => {
  const p = {
    roles: [],
    champions: [],
    mastery: [{ championId: 'Garen', points: 500000 }, { championId: 'Ahri', points: 200000 }],
  };
  const traits = { Garen: { positions: ['TOP'] }, Ahri: { positions: ['MID'] } };
  const { players } = planComposition({ voters: [voters[0]], voteRoles: { p1: 'MID' }, profiles: { p1: p }, traits });
  assert.deepEqual(players[0].champions.map((c) => c.id), ['Ahri']);
});

test('planComposition: il ruolo scelto al voto vince sulle abitudini, i campioni sono quelli di quel ruolo', () => {
  const profiles = {
    p1: profile([['ADC', 8, [['Jinx', 8]]], ['SUPPORT', 2, [['Lulu', 2]]]], [['Jinx', 8], ['Lulu', 2]]),
  };
  // Boco gioca soprattutto ADC ma ha scelto Support
  const { players } = planComposition({ voters: [voters[0]], voteRoles: { p1: 'SUPPORT' }, profiles });
  assert.equal(players[0].role, 'SUPPORT');
  assert.deepEqual(players[0].champions.map((c) => c.id), ['Lulu', 'Jinx']);
});

test('planComposition: chi ha scelto il ruolo lo tiene, gli altri si dividono quelli che restano', () => {
  const profiles = {
    p3: profile([['ADC', 9, [['Ashe', 9]]]]), // Fraboco vorrebbe ADC, ma Boco l'ha già scelto
  };
  const { players } = planComposition({ voters, voteRoles: { p1: 'ADC' }, profiles });
  assert.equal(players.find((p) => p.name === 'Boco').role, 'ADC');
  assert.notEqual(players.find((p) => p.name === 'Fraboco').role, 'ADC');
  assert.equal(new Set(players.map((p) => p.role)).size, 3);
});

test('planComposition: se due hanno scelto lo stesso ruolo vale il primo, l\'altro riceve un ruolo libero', () => {
  const { players } = planComposition({ voters, voteRoles: { p1: 'MID', p2: 'MID' } });
  assert.equal(players.find((p) => p.name === 'Boco').role, 'MID');
  assert.notEqual(players.find((p) => p.name === 'Carre').role, 'MID');
});

test('planComposition: se chi era già in squadra cambia ruolo votando, i campioni si ricalcolano', () => {
  const existing = [{ playerId: 'p1', name: 'Boco', role: 'ADC', champions: [{ id: 'Jinx', name: 'Jinx' }] }];
  const profiles = { p1: profile([['MID', 4, [['Ahri', 4]]]]) };
  const { players } = planComposition({ voters: [voters[0]], voteRoles: { p1: 'MID' }, existing, profiles });
  assert.equal(players[0].role, 'MID');
  assert.deepEqual(players[0].champions.map((c) => c.id), ['Ahri']);
});

test('planComposition: se il ruolo votato è lo stesso di prima, i campioni scelti a mano restano', () => {
  const existing = [{ playerId: 'p1', name: 'Boco', role: 'ADC', champions: [{ id: 'Kaisa', name: 'Kai\'Sa' }] }];
  const { players } = planComposition({ voters: [voters[0]], voteRoles: { p1: 'ADC' }, existing });
  assert.deepEqual(players[0].champions, [{ id: 'Kaisa', name: 'Kai\'Sa' }]);
});

test('roleTakenBy: un ruolo è occupato se un altro ha votato sì con quel ruolo', () => {
  const state = { rsvp: { a: 'yes', b: 'yes' }, voteRoles: { a: 'TOP', b: 'MID' }, players: [] };
  assert.equal(roleTakenBy(state, 'c', 'TOP'), 'a');
  assert.equal(roleTakenBy(state, 'c', 'ADC'), null);
  assert.equal(roleTakenBy(state, 'a', 'TOP'), null); // il proprio ruolo non è un conflitto
});

test('roleTakenBy: chi non è più "yes" libera il ruolo', () => {
  const state = { rsvp: { a: 'maybe' }, voteRoles: { a: 'TOP' }, players: [] };
  assert.equal(roleTakenBy(state, 'c', 'TOP'), null);
});

test('roleTakenBy: conta anche chi è già in squadra, con o senza id', () => {
  const state = {
    rsvp: {},
    voteRoles: {},
    players: [{ playerId: 'p9', role: 'JUNGLE' }, { name: 'Vecchio', role: 'SUPPORT' }],
  };
  assert.equal(roleTakenBy(state, 'c', 'JUNGLE'), 'p9');
  assert.equal(roleTakenBy(state, 'c', 'SUPPORT'), 'Vecchio');
  assert.equal(roleTakenBy(state, 'p9', 'JUNGLE'), null);
});

test('applyVote: "Ci sono" aggiunge solo quel giocatore, con i campioni del ruolo scelto', () => {
  const existing = [{ playerId: 'p2', name: 'Carre', role: 'SUPPORT', champions: [{ id: 'Lulu', name: 'Lulu' }] }];
  const profiles = { p1: profile([['ADC', 5, [['Jinx', 5]]]]) };
  const r = applyVote({ existing, voter: voters[0], isYes: true, role: 'ADC', profile: profiles.p1 });
  assert.deepEqual(r.players.map((p) => [p.name, p.role]), [['Boco', 'ADC'], ['Carre', 'SUPPORT']]);
  assert.deepEqual(r.players.find((p) => p.name === 'Carre').champions, existing[0].champions); // non toccato
  assert.deepEqual(r.players.find((p) => p.name === 'Boco').champions.map((c) => c.id), ['Jinx']);
  assert.deepEqual(r.withoutData, []);
});

test('applyVote: chi non ha dati entra comunque, segnalato', () => {
  const r = applyVote({ existing: [], voter: voters[1], isYes: true, role: 'TOP' });
  assert.equal(r.players[0].role, 'TOP');
  assert.deepEqual(r.players[0].champions, []);
  assert.deepEqual(r.withoutData, ['Carre']);
});

test('applyVote: chi cambia ruolo riceve i campioni del nuovo ruolo e libera il vecchio', () => {
  const existing = [{ playerId: 'p1', name: 'Boco', role: 'ADC', champions: [{ id: 'Jinx', name: 'Jinx' }] }];
  const p = profile([['MID', 3, [['Ahri', 3]]]]);
  const r = applyVote({ existing, voter: voters[0], isYes: true, role: 'MID', profile: p });
  assert.equal(r.players.length, 1);
  assert.equal(r.players[0].role, 'MID');
  assert.deepEqual(r.players[0].champions.map((c) => c.id), ['Ahri']);
});

test('applyVote: se il ruolo non cambia restano i campioni già presenti', () => {
  const existing = [{ playerId: 'p1', name: 'Boco', role: 'ADC', champions: [{ id: 'Kaisa', name: 'Kai\'Sa' }] }];
  const r = applyVote({ existing, voter: voters[0], isYes: true, role: 'ADC', profile: profile([['ADC', 5, [['Jinx', 5]]]]) });
  assert.deepEqual(r.players[0].champions, [{ id: 'Kaisa', name: 'Kai\'Sa' }]);
});

test('applyVote: un voto diverso da "Ci sono" toglie il giocatore e non tocca gli altri', () => {
  const existing = [
    { playerId: 'p1', name: 'Boco', role: 'ADC', champions: [] },
    { playerId: 'p2', name: 'Carre', role: 'SUPPORT', champions: [] },
  ];
  const r = applyVote({ existing, voter: voters[0], isYes: false });
  assert.deepEqual(r.players.map((p) => p.name), ['Carre']);
});

test('planComposition: errore se hanno confermato più di 5', () => {
  const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, name: id }));
  assert.throws(() => planComposition({ voters: six }));
});
