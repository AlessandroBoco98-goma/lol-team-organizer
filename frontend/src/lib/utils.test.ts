import { describe, expect, it } from 'vitest';
import {
  findTeamPlayer,
  opggUrl,
  playersFromRsvp,
  resolveSessionPlayer,
  rsvpCounts,
  rsvpOf,
  whatsappShareUrl,
} from './utils';
import type { Player, SessionPlayer } from '../types';

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
