import { describe, expect, it } from 'vitest';
import { findTeamPlayer, opggUrl, resolveSessionPlayer } from './utils';
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
