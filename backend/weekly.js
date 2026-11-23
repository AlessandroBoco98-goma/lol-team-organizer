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

// Si vota solo da lunedì a venerdì
const WORKWEEK_DAYS = 5;

// Quante conferme ("Ci sono") servono perché una proposta diventi una sessione vera
const CONFIRM_THRESHOLD = 3;

// Le 5 date lunedì-venerdì della prossima settimana
function nextWorkweekDates(now = new Date()) {
  return nextWeekDates(now).slice(0, WORKWEEK_DAYS);
}

// Numero di risposte "Ci sono" in una mappa rsvp { playerId: 'yes' | 'maybe' | 'no' }
function countYes(rsvp) {
  return Object.values(rsvp ?? {}).filter((status) => status === 'yes').length;
}

// Una proposta diventa sessione vera quando le conferme arrivano alla soglia.
// Le sessioni già confermate (o create a mano, senza stato) non cambiano più.
function shouldConfirm(status, rsvp, threshold = CONFIRM_THRESHOLD) {
  return status === 'proposal' && countYes(rsvp) >= threshold;
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

module.exports = {
  TIME_ZONE,
  WEEK_SESSION_TIME,
  WORKWEEK_DAYS,
  CONFIRM_THRESHOLD,
  romeToday,
  nextWeekDates,
  nextWorkweekDates,
  countYes,
  shouldConfirm,
  planWeek,
  weekSessionId,
};
