const TIME_ZONE = 'Europe/Rome';
const WEEK_SESSION_TIME = '21:30';

// Data di oggi (AAAA-MM-GG) nel fuso Europe/Rome, indipendente dal fuso del server
function romeToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Calcoli sui giorni fatti in UTC sul solo calendario: nessuna ora legale di mezzo
function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekday(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domenica, 1 = lunedì
}

// Le 7 date (lunedì-domenica) della prossima settimana, a partire da oggi in Europe/Rome.
// "Prossimo lunedì" è sempre successivo a oggi: da domenica è domani, da lunedì è tra 7 giorni.
function nextWeekDates(now = new Date()) {
  const today = romeToday(now);
  const ahead = (1 - weekday(today) + 7) % 7 || 7;
  const monday = addDays(today, ahead);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// Divide le date tra quelle da creare e quelle da saltare perché esiste già una sessione con stessa data e ora
function planWeek(dates, existing, time = WEEK_SESSION_TIME) {
  const taken = new Set(existing.map((s) => `${s.date} ${s.time}`));
  const toCreate = [];
  const skipped = [];
  for (const date of dates) (taken.has(`${date} ${time}`) ? skipped : toCreate).push(date);
  return { toCreate, skipped };
}

// Id fisso per le sessioni generate: due esecuzioni in contemporanea non possono crearne due per lo stesso giorno
function weekSessionId(date, time = WEEK_SESSION_TIME) {
  return `auto-${date}-${time.replace(':', '')}`;
}

module.exports = { TIME_ZONE, WEEK_SESSION_TIME, romeToday, nextWeekDates, planWeek, weekSessionId };
