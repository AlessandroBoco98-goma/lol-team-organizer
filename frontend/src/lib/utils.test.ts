import { describe, expect, it } from 'vitest';
import {
  countdownLabel,
  countdownParts,
  lobbySlots,
  dateBadge,
  findTeamPlayer,
  isProposal,
  takenRoles,
  votingSessions,
  weekdayName,
  voteInviteUrl,
  normalizePhone,
  opggUrl,
  playersFromRsvp,
  probuildUrl,
  resolveSessionPlayer,
  rsvpCounts,
  rsvpOf,
  whatsappChatUrl,
  whatsappShareUrl,
} from './utils';
import type { Player, Session, SessionPlayer } from '../types';

describe('opggUrl', () => {
  it('costruisce l\'URL con regione minuscola', () => {
    expect(opggUrl('Faker#KR1', 'KR')).toBe('https://www.op.gg/summoners/kr/Faker-KR1');
  });

  it('codifica nome e tag', () => {
    expect(opggUrl('Hide on bush#KR1', 'EUW')).toBe('https://www.op.gg/summoners/euw/Hide%20on%20bush-KR1');
    expect(opggUrl('Ñandú/x#T?G', 'NA')).toBe(
      `https://www.op.gg/summoners/na/${encodeURIComponent('Ñandú/x')}-${encodeURIComponent('T?G')}`,
    );
  });

  it('ritorna null se mancano dati o il formato è errato', () => {
    expect(opggUrl(undefined, 'KR')).toBeNull();
    expect(opggUrl('Faker#KR1', undefined)).toBeNull();
    expect(opggUrl('', 'KR')).toBeNull();
    expect(opggUrl('Faker', 'KR')).toBeNull();
    expect(opggUrl('Faker#', 'KR')).toBeNull();
    expect(opggUrl('#KR1', 'KR')).toBeNull();
    expect(opggUrl('A#B#C', 'KR')).toBeNull();
  });
});

const team: Player[] = [
  { id: 'p1', name: 'Faker', riotId: 'Faker#KR1', region: 'KR', createdAt: '' },
  { id: 'p2', name: 'Chovy', createdAt: '' },
];
const sp = (patch: Partial<SessionPlayer>): SessionPlayer => ({ name: 'x', role: 'MID', champions: [], ...patch });

describe('rsvpOf / rsvpCounts', () => {
  const players = [sp({ playerId: 'p1', name: 'Faker', role: 'MID' }), sp({ name: 'Chovy', role: 'TOP' })];

  it('legge la risposta per id, anche per sessioni vecchie collegate per nome', () => {
    const session = { players, rsvp: { p1: 'yes', p2: 'maybe' } as const };
    expect(rsvpOf(session, players[0], team)).toBe('yes');
    expect(rsvpOf(session, players[1], team)).toBe('maybe');
  });

  it('conta le risposte su tutto il roster, anche per chi non è in sessione', () => {
    expect(rsvpCounts({ rsvp: { p1: 'no' } }, team)).toEqual({ yes: 0, maybe: 0, no: 1, pending: 1 });
    expect(rsvpCounts({ rsvp: { p1: 'yes', p2: 'maybe' } }, team)).toEqual({ yes: 1, maybe: 1, no: 0, pending: 0 });
  });

  it('senza rsvp sono tutti in attesa', () => {
    expect(rsvpCounts({}, team)).toEqual({ yes: 0, maybe: 0, no: 0, pending: 2 });
  });

  it('ignora le risposte di giocatori non più nel roster', () => {
    expect(rsvpCounts({ rsvp: { gone: 'yes' } }, team).yes).toBe(0);
    const outside = sp({ name: 'Sconosciuto', role: 'ADC' });
    expect(rsvpOf({ rsvp: { p1: 'yes' } }, outside, team)).toBeUndefined();
  });
});

describe('playersFromRsvp', () => {
  const big: Player[] = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, name: id.toUpperCase(), createdAt: '' }));

  it('costruisce la squadra dai "Ci sono" con ruoli diversi e senza campioni', () => {
    const r = playersFromRsvp({ players: [], rsvp: { p1: 'yes', p2: 'yes' } }, team)!;
    expect(r.map((p) => p.playerId)).toEqual(['p1', 'p2']);
    expect(new Set(r.map((p) => p.role)).size).toBe(2);
    expect(r.every((p) => p.champions.length === 0)).toBe(true);
    expect(r[0]).toMatchObject({ riotId: 'Faker#KR1', region: 'KR' });
  });

  it('ignora forse, no e chi non ha risposto', () => {
    const r = playersFromRsvp({ players: [], rsvp: { p1: 'maybe', p2: 'no' } }, team)!;
    expect(r).toEqual([]);
  });

  it('mantiene ruolo e campioni di chi era già in sessione e toglie chi non c\'è più', () => {
    const existing = [
      sp({ playerId: 'p1', name: 'Faker', role: 'SUPPORT', champions: [{ id: 'Lulu', name: 'Lulu' }] }),
      sp({ playerId: 'p2', name: 'Chovy', role: 'TOP' }),
    ];
    const r = playersFromRsvp({ players: existing, rsvp: { p1: 'yes', p2: 'no' } }, team)!;
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ playerId: 'p1', role: 'SUPPORT' });
    expect(r[0].champions).toHaveLength(1);
  });

  it('assegna ai nuovi arrivati i ruoli ancora liberi', () => {
    const existing = [sp({ playerId: 'p1', name: 'Faker', role: 'TOP' })];
    const r = playersFromRsvp({ players: existing, rsvp: { p1: 'yes', p2: 'yes' } }, team)!;
    expect(r.find((p) => p.playerId === 'p2')!.role).not.toBe('TOP');
  });

  it('ritorna null se i "Ci sono" sono più dei ruoli', () => {
    const rsvp = Object.fromEntries(big.map((p) => [p.id, 'yes' as const]));
    expect(playersFromRsvp({ players: [], rsvp }, big)).toBeNull();
    const five = Object.fromEntries(big.slice(0, 5).map((p) => [p.id, 'yes' as const]));
    expect(playersFromRsvp({ players: [], rsvp: five }, big)).toHaveLength(5);
  });
});

describe('isProposal / votingSessions', () => {
  const s = (patch: Partial<Session>): Session => ({
    id: 'x', date: '2026-12-01', time: '21:30', players: [], notes: '', createdAt: '', ...patch,
  });
  const now = new Date('2026-11-30T12:00:00');

  it('solo lo stato "proposal" è una proposta', () => {
    expect(isProposal(s({ status: 'proposal' }))).toBe(true);
    expect(isProposal(s({ status: 'confirmed' }))).toBe(false);
    expect(isProposal(s({}))).toBe(false); // sessioni create a mano o vecchie
  });

  it('la votazione include le proposte e le confermate nate da lì, non le sessioni a mano', () => {
    const list = [
      s({ id: 'a', date: '2026-12-02', source: 'weekly', status: 'confirmed' }),
      s({ id: 'b', date: '2026-12-01', source: 'weekly', status: 'proposal' }),
      s({ id: 'm', date: '2026-12-01' }), // a mano
    ];
    expect(votingSessions(list, now).map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('esclude i giorni già passati', () => {
    const list = [s({ id: 'old', date: '2026-11-29', source: 'weekly', status: 'proposal' }), s({ id: 'ok', source: 'weekly', status: 'proposal' })];
    expect(votingSessions(list, now).map((x) => x.id)).toEqual(['ok']);
  });
});

describe('takenRoles', () => {
  const roster: Player[] = [
    { id: 'p1', name: 'Faker', createdAt: '' },
    { id: 'p2', name: 'Chovy', createdAt: '' },
  ];

  it('elenca i ruoli scelti votando "Ci sono", con il nome di chi li ha', () => {
    const t = takenRoles({ players: [], rsvp: { p1: 'yes', p2: 'yes' }, voteRoles: { p1: 'MID', p2: 'TOP' } }, roster);
    expect(t).toEqual({ MID: 'Faker', TOP: 'Chovy' });
  });

  it('chi non ha più "Ci sono" libera il ruolo', () => {
    const t = takenRoles({ players: [], rsvp: { p1: 'maybe' }, voteRoles: { p1: 'MID' } }, roster);
    expect(t).toEqual({});
  });

  it('conta anche i giocatori già in squadra', () => {
    const players: SessionPlayer[] = [{ playerId: 'p2', name: 'Chovy', role: 'JUNGLE', champions: [] }];
    expect(takenRoles({ players, rsvp: {} }, roster)).toEqual({ JUNGLE: 'Chovy' });
  });

  it('il proprio ruolo non è occupato per sé', () => {
    const t = takenRoles({ players: [], rsvp: { p1: 'yes', p2: 'yes' }, voteRoles: { p1: 'MID', p2: 'TOP' } }, roster, 'p1');
    expect(t).toEqual({ TOP: 'Chovy' });
  });
});

describe('weekdayName / voteInviteUrl', () => {
  it('dà il nome esteso del giorno', () => {
    expect(weekdayName('2026-11-30')).toBe('lunedì');
    expect(weekdayName('2026-12-04')).toBe('venerdì');
  });

  it('il messaggio rimanda alla pagina di votazione e cita la soglia', () => {
    const url = voteInviteUrl('https://lol.example.com', 3);
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toContain('https://lol.example.com/vota');
    expect(text).toContain('3 conferme');
  });
});

describe('countdownParts', () => {
  const now = new Date('2026-11-18T12:00:00');

  it('scompone il tempo mancante', () => {
    const t = new Date('2026-11-20T14:30:15');
    expect(countdownParts(t, now)).toEqual({ total: t.getTime() - now.getTime(), days: 2, hours: 2, minutes: 30, seconds: 15 });
  });

  it('non va in negativo a evento passato', () => {
    expect(countdownParts(new Date('2026-11-18T11:00:00'), now)).toEqual({ total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});

describe('lobbySlots', () => {
  const roster: Player[] = [
    { id: 'p1', name: 'Faker', createdAt: '' },
    { id: 'p2', name: 'Chovy', createdAt: '' },
    { id: 'p3', name: 'Zeus', createdAt: '' },
  ];

  it('con la composizione fatta ha un posto per ruolo, nell\'ordine dei ruoli', () => {
    const players: SessionPlayer[] = [
      { playerId: 'p1', name: 'Faker', role: 'MID', champions: [{ id: 'Ahri', name: 'Ahri' }] },
      { playerId: 'p2', name: 'Chovy', role: 'TOP', champions: [] },
    ];
    const slots = lobbySlots({ players, rsvp: { p1: 'yes', p2: 'maybe' } }, roster);
    expect(slots.map((s) => s.role)).toEqual(['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT']);
    expect(slots[0]).toMatchObject({ name: 'Chovy', status: 'maybe' });
    expect(slots[2]).toMatchObject({ name: 'Faker', championId: 'Ahri', status: 'yes' });
    expect(slots[1]).toEqual({ role: 'JUNGLE' });
  });

  it('senza composizione mostra solo chi ha confermato, gli altri posti sono vuoti', () => {
    const slots = lobbySlots({ players: [], rsvp: { p1: 'yes', p2: 'maybe', p3: 'yes' } }, roster);
    expect(slots).toHaveLength(5);
    expect(slots.filter((s) => s.name).map((s) => s.name)).toEqual(['Faker', 'Zeus']);
    expect(slots[4]).toEqual({});
  });

  it('non supera i 5 posti', () => {
    const big: Player[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ id, name: id, createdAt: '' }));
    const rsvp = Object.fromEntries(big.map((p) => [p.id, 'yes' as const]));
    expect(lobbySlots({ players: [], rsvp }, big)).toHaveLength(5);
  });
});

describe('probuildUrl', () => {
  it('usa l\'id di Data Dragon in minuscolo', () => {
    expect(probuildUrl('Jinx')).toBe('https://probuildstats.com/champion/jinx');
    expect(probuildUrl('AurelionSol')).toBe('https://probuildstats.com/champion/aurelionsol');
    expect(probuildUrl('DrMundo')).toBe('https://probuildstats.com/champion/drmundo');
    expect(probuildUrl('Belveth')).toBe('https://probuildstats.com/champion/belveth');
  });

  it('gestisce l\'unica eccezione: Wukong', () => {
    expect(probuildUrl('MonkeyKing')).toBe('https://probuildstats.com/champion/wukong');
  });
});

describe('countdownLabel / dateBadge', () => {
  const now = new Date('2026-11-18T12:00:00');

  it('mostra minuti, ore, domani e giorni', () => {
    expect(countdownLabel({ date: '2026-11-18', time: '12:30' }, now)).toBe('tra 30 min');
    expect(countdownLabel({ date: '2026-11-18', time: '13:00' }, now)).toBe('tra 1 ora');
    expect(countdownLabel({ date: '2026-11-18', time: '21:30' }, now)).toBe('tra 9 ore');
    expect(countdownLabel({ date: '2026-11-19', time: '09:00' }, now)).toBe('Domani');
    expect(countdownLabel({ date: '2026-11-23', time: '20:00' }, now)).toBe('tra 5 giorni');
  });

  it('distingue sessione in corso e conclusa', () => {
    expect(countdownLabel({ date: '2026-11-18', time: '11:00' }, now)).toBe('In corso');
    expect(countdownLabel({ date: '2026-11-18', time: '09:00' }, now)).toBe('Conclusa');
    expect(countdownLabel({ date: '2026-11-16', time: '21:30' }, now)).toBe('Conclusa');
  });

  it('ricava giorno e mese per il badge', () => {
    const b = dateBadge('2026-11-18');
    expect(b.day).toBe('18');
    expect(b.month.startsWith('nov')).toBe(true);
    expect(b.weekday.startsWith('mer')).toBe(true);
  });
});

describe('normalizePhone / whatsappChatUrl', () => {
  it('normalizza il formato internazionale', () => {
    expect(normalizePhone('+39 333 123-4567')).toBe('+393331234567');
    expect(normalizePhone('0039 333 1234567')).toBe('+393331234567');
    expect(normalizePhone('  ')).toBe('');
  });

  it('rifiuta numeri senza + o malformati', () => {
    expect(normalizePhone('3331234567')).toBeNull();
    expect(normalizePhone('+39abc')).toBeNull();
  });

  it('costruisce il link della chat con solo le cifre', () => {
    const url = whatsappChatUrl('+393331234567', 'Ciao & grazie');
    expect(url).toBe('https://wa.me/393331234567?text=Ciao%20%26%20grazie');
  });
});

describe('whatsappShareUrl', () => {
  it('contiene data, ora e link alla sessione, codificati', () => {
    const url = whatsappShareUrl({ id: 'abc', date: '2026-11-18', time: '21:30' }, 'https://lol.example.com');
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toContain('21:30');
    expect(text).toContain('https://lol.example.com/session/abc');
  });
});

describe('findTeamPlayer / resolveSessionPlayer', () => {
  it('trova per id anche se il giocatore è stato rinominato', () => {
    const renamed = [{ ...team[0], name: 'Faker2' }, team[1]];
    expect(findTeamPlayer(sp({ playerId: 'p1', name: 'Faker' }), renamed)?.id).toBe('p1');
    expect(resolveSessionPlayer(sp({ playerId: 'p1', name: 'Faker' }), renamed).name).toBe('Faker2');
  });

  it('per le sessioni vecchie senza id usa il nome e aggiunge Riot ID e regione', () => {
    const r = resolveSessionPlayer(sp({ name: 'Faker' }), team);
    expect(r).toMatchObject({ playerId: 'p1', riotId: 'Faker#KR1', region: 'KR' });
  });

  it('toglie Riot ID e regione se nel roster non ci sono più', () => {
    const r = resolveSessionPlayer(sp({ playerId: 'p2', name: 'Chovy', riotId: 'Old#EUW', region: 'EUW' }), team);
    expect(r.riotId).toBeUndefined();
    expect(r.region).toBeUndefined();
  });

  it('lascia invariato un giocatore non più nel roster', () => {
    const gone = sp({ name: 'Sconosciuto', riotId: 'Gone#EUW', region: 'EUW' });
    expect(resolveSessionPlayer(gone, team)).toBe(gone);
  });
});
