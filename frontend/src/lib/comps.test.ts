import { describe, expect, it } from 'vitest';
import { buildCandidates, masteryScore, proposeComps, roleCoverage, roleGapLabel, scoreComp, type CompPlayer } from './comps';
import type { ChampionTraits, RiotProfile, Role, TraitMap } from '../types';

const trait = (p: Partial<ChampionTraits>): ChampionTraits => ({
  damage: 2,
  durability: 1,
  crowdControl: 1,
  mobility: 1,
  utility: 1,
  damageType: 'physical',
  positions: null,
  source: 'test',
  ...p,
});

const traits: TraitMap = {
  Garen: trait({ durability: 3, crowdControl: 1, positions: ['TOP'] }),
  Ornn: trait({ durability: 3, crowdControl: 3, damageType: 'magic', positions: ['TOP'] }),
  Zed: trait({ mobility: 3, positions: ['MID', 'JUNGLE'] }),
  Ahri: trait({ damageType: 'magic', mobility: 2, crowdControl: 2, positions: ['MID'] }),
  Syndra: trait({ damageType: 'magic', crowdControl: 2, positions: ['MID'] }),
  Vi: trait({ durability: 2, crowdControl: 3, positions: ['JUNGLE'] }),
  Jinx: trait({ damage: 3, positions: ['ADC'] }),
  Ashe: trait({ crowdControl: 3, positions: ['ADC', 'SUPPORT'] }),
  Lulu: trait({ damageType: 'magic', utility: 3, crowdControl: 2, positions: ['SUPPORT'] }),
  Leona: trait({ durability: 3, crowdControl: 3, positions: ['SUPPORT'] }),
};

const profile = (roles: [Role, number, [string, number][]][], mastery: [string, number][] = []): RiotProfile => ({
  riotId: 'X#EUW',
  region: 'EUW',
  ranks: [],
  recent: [],
  champions: [],
  gamesAnalyzed: 0,
  updatedAt: '',
  roles: roles.map(([role, games, champs]) => ({
    role,
    games,
    champions: champs.map(([championId, g]) => ({ championId, games: g })),
  })),
  mastery: mastery.map(([championId, points]) => ({ championId, level: 5, points, lastPlayedAt: null })),
});

describe('masteryScore', () => {
  it('cresce con i punti: 1k ~ 0, 100k ~ 0.74, 500k ~ 1', () => {
    expect(masteryScore(0)).toBe(0);
    expect(masteryScore(1000)).toBeCloseTo(0, 1);
    expect(masteryScore(100_000)).toBeGreaterThan(0.7);
    expect(masteryScore(100_000)).toBeLessThan(0.8);
    expect(masteryScore(900_000)).toBe(1);
  });
});

describe('buildCandidates', () => {
  it('unisce partite nel ruolo e maestria, dal più comodo', () => {
    const p = profile([['ADC', 6, [['Jinx', 4], ['Ashe', 2]]]], [['Ashe', 300_000], ['Jinx', 20_000]]);
    const c = buildCandidates(p, 'ADC', traits);
    expect(c.map((x) => x.championId)).toEqual(['Ashe', 'Jinx']);
    expect(c[0].comfort).toBeGreaterThan(0.6);
    expect(c.every((x) => x.comfort > 0 && x.comfort <= 1)).toBe(true);
  });

  it('un campione molto usato ma di un altro ruolo entra come "fuori ruolo" con il comfort dimezzato', () => {
    const p = profile([], [['Garen', 900_000], ['Ahri', 100_000]]);
    const c = buildCandidates(p, 'MID', traits);
    expect(c.map((x) => x.championId)).toEqual(['Ahri', 'Garen']);
    expect(c[0].offRole).toBeUndefined();
    expect(c[1].offRole).toBe(true);
    expect(c[1].comfort).toBeCloseTo(0.3, 1);
  });

  it('solo i 5 più usati entrano fuori ruolo: i campioni oltre il quinto restano esclusi', () => {
    const p = profile([], [
      ['Garen', 900_000], ['Ornn', 800_000], ['Vi', 700_000], ['Jinx', 600_000], ['Leona', 500_000], ['Lulu', 400_000], ['Ahri', 50_000],
    ]);
    const ids = buildCandidates(p, 'MID', traits, 20).map((x) => x.championId);
    expect(ids).toContain('Ahri');
    expect(ids).toContain('Leona');
    expect(ids).not.toContain('Lulu');
  });

  it('allega i dati del meta pro per campione e ruolo', () => {
    const p = profile([], [['Ahri', 100_000]]);
    const meta = { updatedAt: '', windowDays: 45, games: 100, tournaments: [], source: 'Leaguepedia', sourceUrl: '', license: '', champions: { Ahri: { MID: { games: 20, wins: 12, pickRate: 0.2, winRate: 0.6, score: 0.8 } } } };
    expect(buildCandidates(p, 'MID', traits, 8, meta)[0].meta?.pickRate).toBe(0.2);
    expect(buildCandidates(p, 'MID', traits, 8)[0].meta).toBeUndefined();
  });

  it('un campione giocato nel ruolo conta anche se i suoi ruoli noti sono altri (off-meta)', () => {
    const p = profile([['MID', 4, [['Garen', 4]]]]);
    expect(buildCandidates(p, 'MID', traits).map((x) => x.championId)).toEqual(['Garen']);
  });

  it('senza tratti la maestria vale per ogni ruolo; senza profilo non ci sono candidati', () => {
    const p = profile([], [['Nuovo', 200_000]]);
    expect(buildCandidates(p, 'TOP', {}).map((x) => x.championId)).toEqual(['Nuovo']);
    expect(buildCandidates(undefined, 'TOP', traits)).toEqual([]);
  });

  it('rispetta il massimo', () => {
    const p = profile([], Array.from({ length: 12 }, (_, i) => [`C${i}`, 100_000 + i] as [string, number]));
    expect(buildCandidates(p, 'TOP', {}, 4)).toHaveLength(4);
  });
});

describe('scoreComp', () => {
  it('una comp bilanciata batte una tutta fisica a parità di comfort', () => {
    const mixed = scoreComp(
      [{ championId: 'Garen', comfort: 0.6 }, { championId: 'Vi', comfort: 0.6 }, { championId: 'Ahri', comfort: 0.6 }, { championId: 'Jinx', comfort: 0.6 }, { championId: 'Leona', comfort: 0.6 }],
      traits,
    );
    const allAd = scoreComp(
      [{ championId: 'Garen', comfort: 0.6 }, { championId: 'Zed', comfort: 0.6 }, { championId: 'Jinx', comfort: 0.6 }, { championId: 'Ashe', comfort: 0.6 }],
      traits,
    );
    expect(mixed.breakdown.mix).toBeGreaterThan(allAd.breakdown.mix);
    expect(allAd.breakdown.adShare).toBeGreaterThan(0.9);
  });

  it('il comfort pesa molto: slot vuoti abbassano il punteggio', () => {
    const full = scoreComp([{ championId: 'Garen', comfort: 0.8 }, { championId: 'Ahri', comfort: 0.8 }], traits);
    const half = scoreComp([{ championId: 'Garen', comfort: 0.8 }, { comfort: 0 }], traits);
    expect(full.score).toBeGreaterThan(half.score);
  });

  it('campioni senza tratti usano valori neutri e non fanno fallire il calcolo', () => {
    expect(() => scoreComp([{ championId: 'Sconosciuto', comfort: 0.5 }], {})).not.toThrow();
    expect(scoreComp([], traits).score).toBe(0);
  });

  it('con il meta dei tornei un pick forte fa salire il punteggio, senza meta i pesi non cambiano', () => {
    const stat = { games: 30, wins: 18, pickRate: 0.3, winRate: 0.6, score: 1 };
    const withMeta = scoreComp([{ championId: 'Ahri', comfort: 0.6, meta: stat }], traits, true);
    const noMeta = scoreComp([{ championId: 'Ahri', comfort: 0.6 }], traits, true);
    expect(withMeta.score).toBeGreaterThan(noMeta.score);
    expect(withMeta.breakdown.meta).toBe(1);
    expect(scoreComp([{ championId: 'Ahri', comfort: 0.6 }], traits).breakdown.meta).toBeNull();
  });

  it('prima linea e controllo salgono con campioni resistenti e con CC', () => {
    const squishy = scoreComp([{ championId: 'Jinx', comfort: 0.5 }, { championId: 'Zed', comfort: 0.5 }, { championId: 'Syndra', comfort: 0.5 }], traits);
    const tanky = scoreComp([{ championId: 'Ornn', comfort: 0.5 }, { championId: 'Leona', comfort: 0.5 }, { championId: 'Vi', comfort: 0.5 }], traits);
    expect(tanky.breakdown.front).toBeGreaterThan(squishy.breakdown.front);
    expect(tanky.breakdown.control).toBeGreaterThan(squishy.breakdown.control);
  });
});

const cand = (championId: string, comfort: number) => ({ championId, comfort, points: 0, roleGames: 0 });

const team = (): CompPlayer[] => [
  { name: 'T', role: 'TOP', candidates: [cand('Garen', 0.7), cand('Ornn', 0.6)] },
  { name: 'J', role: 'JUNGLE', candidates: [cand('Vi', 0.7), cand('Zed', 0.5)] },
  { name: 'M', role: 'MID', candidates: [cand('Zed', 0.8), cand('Ahri', 0.6), cand('Syndra', 0.5)] },
  { name: 'A', role: 'ADC', candidates: [cand('Jinx', 0.7), cand('Ashe', 0.6)] },
  { name: 'S', role: 'SUPPORT', candidates: [cand('Lulu', 0.7), cand('Leona', 0.6)] },
];

describe('proposeComps', () => {
  it('propone 3 comp, dalla migliore, con un pick per giocatore', () => {
    const comps = proposeComps(team(), traits);
    expect(comps).toHaveLength(3);
    expect(comps[0].score).toBeGreaterThanOrEqual(comps[1].score);
    expect(comps[1].score).toBeGreaterThanOrEqual(comps[2].score);
    for (const c of comps) {
      expect(c.picks.map((p) => p.role)).toEqual(['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT']);
      expect(c.picks.every((p) => !!p.championId)).toBe(true);
      expect(c.notes.length).toBeGreaterThan(0);
    }
  });

  it('le comp sono diverse tra loro (almeno 2 pick cambiano)', () => {
    const comps = proposeComps(team(), traits);
    for (let i = 0; i < comps.length; i++) {
      for (let j = i + 1; j < comps.length; j++) {
        const changed = comps[i].picks.filter((p, k) => p.championId !== comps[j].picks[k].championId).length;
        expect(changed).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('non propone lo stesso campione a due giocatori', () => {
    // Zed è candidato sia per jungle sia per mid
    for (const c of proposeComps(team(), traits)) {
      const ids = c.picks.map((p) => p.championId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('un giocatore senza dati lascia lo slot vuoto e lo segnala', () => {
    const t = team();
    t[2] = { name: 'M', role: 'MID', candidates: [] };
    const comps = proposeComps(t, traits);
    expect(comps.length).toBeGreaterThan(0);
    expect(comps[0].picks[2].championId).toBeUndefined();
    expect(comps[0].notes.some((n) => n.level === 'warn' && n.text.includes('M'))).toBe(true);
  });

  it('con pochi candidati restituisce meno comp senza errori', () => {
    const one: CompPlayer[] = [{ name: 'A', role: 'ADC', candidates: [cand('Jinx', 0.7)] }];
    expect(proposeComps(one, traits)).toHaveLength(1);
    expect(proposeComps([], traits)).toEqual([]);
  });

  it('il comfort alto pesa: il campione molto giocato viene scelto', () => {
    const t = team();
    t[3] = { name: 'A', role: 'ADC', candidates: [cand('Jinx', 0.95), cand('Ashe', 0.2)] };
    expect(proposeComps(t, traits)[0].picks[3].championId).toBe('Jinx');
  });
});

describe('roleCoverage / roleGapLabel', () => {
  const roster = [
    { playerId: 'p1', name: 'Boco', profile: profile([['ADC', 6, [['Jinx', 6]]]], [['Jinx', 300_000]]) },
    { playerId: 'p2', name: 'Carre', profile: profile([['SUPPORT', 5, [['Lulu', 5]]]], [['Lulu', 200_000]]) },
    { playerId: 'p3', name: 'Senza dati', profile: undefined },
  ];

  it('elenca chi gioca ogni ruolo e salta chi non ha dati', () => {
    const cov = roleCoverage(roster, traits);
    expect(cov.find((c) => c.role === 'ADC')!.players.map((p) => p.name)).toEqual(['Boco']);
    expect(cov.find((c) => c.role === 'SUPPORT')!.players.map((p) => p.name)).toEqual(['Carre']);
    expect(cov.find((c) => c.role === 'TOP')!.players).toEqual([]);
  });

  it('segnala i ruoli senza nessuno', () => {
    expect(roleGapLabel(roleCoverage(roster, traits))).toBe('Top, Jungle, Mid');
    expect(roleGapLabel([{ role: 'TOP', players: [{ playerId: 'p', name: 'x', best: cand('Garen', 0.9), depth: 1 }] }])).toBeNull();
  });
});
