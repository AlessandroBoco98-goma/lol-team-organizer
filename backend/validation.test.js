const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRiotFields, parseRsvp, validateSession, sessionFields } = require('./validation');

const champ = { id: 'Ahri', name: 'Ahri' };
const basePlayer = { name: 'Faker', role: 'MID', champions: [champ] };
const baseSession = (players) => ({ date: '2026-12-01', time: '20:00', players });

test('parseRiotFields: campi assenti o vuoti sono ammessi', () => {
  assert.deepEqual(parseRiotFields({}), {});
  assert.deepEqual(parseRiotFields({ riotId: '  ', region: '' }), {});
  assert.deepEqual(parseRiotFields(undefined), {});
});

test('parseRiotFields: normalizza spazi e maiuscole della regione', () => {
  assert.deepEqual(parseRiotFields({ riotId: ' Faker#KR1 ', region: 'kr' }), { riotId: 'Faker#KR1', region: 'KR' });
});

test('parseRiotFields: riotId e regione vanno indicati insieme', () => {
  assert.ok(parseRiotFields({ riotId: 'Faker#KR1' }).error);
  assert.ok(parseRiotFields({ region: 'KR' }).error);
});

test('parseRiotFields: rifiuta formati e regioni non validi', () => {
  for (const riotId of ['Faker', 'Faker#', '#KR1', 'Fa#KR1', 'Faker#KR', 'Faker#KR1234', 'Fa#ker#KR1', 'Faker#KR-1']) {
    assert.ok(parseRiotFields({ riotId, region: 'KR' }).error, `dovrebbe rifiutare ${riotId}`);
  }
  assert.ok(parseRiotFields({ riotId: 'Faker#KR1', region: 'XX' }).error);
});

test('validateSession: una sessione vecchia senza campi nuovi resta valida', () => {
  assert.equal(validateSession(baseSession([basePlayer])), null);
});

test('validateSession: accetta playerId, riotId e regione', () => {
  const p = { ...basePlayer, playerId: 'abc', riotId: 'Faker#KR1', region: 'KR' };
  assert.equal(validateSession(baseSession([p])), null);
});

test('validateSession: rifiuta Riot ID non valido, ruoli duplicati e troppi campioni', () => {
  assert.ok(validateSession(baseSession([{ ...basePlayer, riotId: 'Faker', region: 'KR' }])));
  assert.equal(validateSession(baseSession([basePlayer, { ...basePlayer, name: 'Altro' }])), 'Ruoli duplicati');
  assert.ok(validateSession(baseSession([{ ...basePlayer, champions: [champ, champ, champ, champ] }])));
});

test('parseRsvp: accetta gli stati validi', () => {
  for (const status of ['yes', 'maybe', 'no']) {
    assert.deepEqual(parseRsvp({ playerId: 'p1', status }), { playerId: 'p1', status });
  }
});

test('parseRsvp: status vuoto o null annulla la risposta', () => {
  assert.deepEqual(parseRsvp({ playerId: 'p1', status: null }), { playerId: 'p1', status: null });
  assert.deepEqual(parseRsvp({ playerId: 'p1', status: '' }), { playerId: 'p1', status: null });
  assert.deepEqual(parseRsvp({ playerId: 'p1' }), { playerId: 'p1', status: null });
});

test('parseRsvp: rifiuta stato o giocatore non validi', () => {
  assert.ok(parseRsvp({ playerId: 'p1', status: 'forse' }).error);
  assert.ok(parseRsvp({ playerId: '  ', status: 'yes' }).error);
  assert.ok(parseRsvp({ status: 'yes' }).error);
  assert.ok(parseRsvp({ playerId: 123, status: 'yes' }).error);
  assert.ok(parseRsvp(undefined).error);
});

test('sessionFields: non include rsvp (si modifica solo dall\'endpoint dedicato)', () => {
  const fields = sessionFields({ ...baseSession([basePlayer]), rsvp: { p1: 'yes' } });
  assert.equal('rsvp' in fields, false);
});

test('sessionFields: salva i campi opzionali solo se presenti', () => {
  const [old] = sessionFields(baseSession([basePlayer])).players;
  assert.deepEqual(Object.keys(old).sort(), ['champions', 'name', 'role']);

  const [full] = sessionFields(
    baseSession([{ ...basePlayer, playerId: 'abc', riotId: 'Faker#KR1', region: 'kr', extra: 'ignorato' }]),
  ).players;
  assert.equal(full.playerId, 'abc');
  assert.equal(full.riotId, 'Faker#KR1');
  assert.equal(full.region, 'KR');
  assert.equal('extra' in full, false);
});
