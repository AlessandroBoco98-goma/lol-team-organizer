const test = require('node:test');
const assert = require('node:assert/strict');
const { romeToday, nextWeekDates, planWeek, weekSessionId, WEEK_SESSION_TIME } = require('./weekly');

const MON_TO_SUN = (monday) => {
  const [y, m, d] = monday.split('-').map(Number);
  return Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
};

test('nextWeekDates: da domenica il prossimo lunedì è domani', () => {
  // domenica 22 novembre 2026, 19:00 a Roma (18:00 UTC), come l'esecuzione del cron
  const dates = nextWeekDates(new Date('2026-11-22T18:00:00Z'));
  assert.deepEqual(dates, MON_TO_SUN('2026-11-23'));
  assert.equal(new Date(`${dates[0]}T12:00:00Z`).getUTCDay(), 1);
  assert.equal(new Date(`${dates[6]}T12:00:00Z`).getUTCDay(), 0);
});

test('nextWeekDates: da lunedì è il lunedì della settimana dopo, non oggi', () => {
  assert.equal(nextWeekDates(new Date('2026-11-23T10:00:00Z'))[0], '2026-11-30');
});

test('nextWeekDates: da martedì a sabato punta al lunedì successivo', () => {
  assert.equal(nextWeekDates(new Date('2026-11-24T10:00:00Z'))[0], '2026-11-30'); // martedì
  assert.equal(nextWeekDates(new Date('2026-11-28T10:00:00Z'))[0], '2026-11-30'); // sabato
});

test('romeToday: usa il fuso Europe/Rome, non UTC', () => {
  // 23:30 UTC di sabato sono già le 00:30 di domenica a Roma (CET, UTC+1)
  assert.equal(romeToday(new Date('2026-11-21T23:30:00Z')), '2026-11-22');
  // in estate (CEST, UTC+2) basta 22:30 UTC
  assert.equal(romeToday(new Date('2026-07-18T22:30:00Z')), '2026-07-19');
  assert.equal(romeToday(new Date('2026-07-18T21:30:00Z')), '2026-07-18');
});

test('nextWeekDates: la mezzanotte di Roma sposta la settimana, anche se in UTC è ancora sabato', () => {
  // sabato 21 novembre 23:30 UTC = domenica 22 a Roma: il prossimo lunedì è il 23
  assert.equal(nextWeekDates(new Date('2026-11-21T23:30:00Z'))[0], '2026-11-23');
  // sabato 21 novembre 22:30 UTC = sabato 21 23:30 a Roma: il prossimo lunedì è sempre il 23
  assert.equal(nextWeekDates(new Date('2026-11-21T22:30:00Z'))[0], '2026-11-23');
});

test('nextWeekDates: attraversa il cambio ora legale e fine anno senza saltare giorni', () => {
  // ora legale europea 2026: domenica 29 marzo
  const march = nextWeekDates(new Date('2026-03-27T12:00:00Z')); // venerdì
  assert.deepEqual(march, MON_TO_SUN('2026-03-30'));
  const nye = nextWeekDates(new Date('2026-12-27T12:00:00Z')); // domenica
  assert.deepEqual(nye, MON_TO_SUN('2026-12-28'));
  assert.equal(nye[4], '2027-01-01');
});

test('planWeek: salta solo le date che hanno già una sessione alla stessa ora', () => {
  const dates = ['2026-11-23', '2026-11-24', '2026-11-25'];
  const existing = [
    { date: '2026-11-23', time: '21:30' }, // uguale: si salta
    { date: '2026-11-24', time: '20:00' }, // altra ora: si crea comunque
  ];
  assert.deepEqual(planWeek(dates, existing), { toCreate: ['2026-11-24', '2026-11-25'], skipped: ['2026-11-23'] });
});

test('planWeek: senza sessioni esistenti crea tutto, con tutto già presente non crea nulla', () => {
  const dates = nextWeekDates(new Date('2026-11-22T18:00:00Z'));
  assert.equal(planWeek(dates, []).toCreate.length, 7);
  const all = dates.map((date) => ({ date, time: WEEK_SESSION_TIME }));
  assert.deepEqual(planWeek(dates, all), { toCreate: [], skipped: dates });
});

test('weekSessionId: id stabile per data e ora', () => {
  assert.equal(weekSessionId('2026-11-23'), 'auto-2026-11-23-2130');
  assert.equal(weekSessionId('2026-11-23'), weekSessionId('2026-11-23'));
});
