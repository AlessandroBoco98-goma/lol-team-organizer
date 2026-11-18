import { describe, expect, it } from 'vitest';
import { analyzeComposition, blockReason, mainChampion } from './composition';
import type { Champion, Draft, SessionPlayer } from '../types';

const champ = (id: string, tags: string[], attack: number, magic: number): Champion => ({
  id,
  name: id,
  key: id,
  image: '',
  tags,
  info: { attack, defense: 3, magic, difficulty: 5 },
});

const champions: Champion[] = [
  champ('Garen', ['Fighter', 'Tank'], 7, 1),
  champ('Jinx', ['Marksman'], 9, 2),
  champ('Zed', ['Assassin'], 9, 1),
  champ('Ahri', ['Mage', 'Assassin'], 3, 8),
  champ('Lux', ['Mage', 'Support'], 2, 9),
  champ('Lulu', ['Support', 'Mage'], 4, 7),
  champ('Syndra', ['Mage'], 2, 9),
];

const player = (name: string, role: SessionPlayer['role'], ids: string[]): SessionPlayer => ({
  name,
  role,
  champions: ids.map((id) => ({ id, name: id })),
});

const draft = (patch: Partial<Draft> = {}): Draft => ({ allyBans: [], enemyBans: [], enemyPicks: [], notes: '', ...patch });
const pick = (id: string) => ({ id, name: id });

describe('blockReason / mainChampion', () => {
  it('riconosce ban nostri, ban nemici e pick nemici', () => {
    const d = draft({ allyBans: [pick('Zed')], enemyBans: [pick('Ahri')], enemyPicks: [pick('Lux')] });
    expect(blockReason('Zed', d)).toBe('ally-ban');
    expect(blockReason('Ahri', d)).toBe('enemy-ban');
    expect(blockReason('Lux', d)).toBe('enemy-pick');
    expect(blockReason('Garen', d)).toBeNull();
    expect(blockReason('Garen', undefined)).toBeNull();
  });

  it('il campione principale salta quelli non disponibili', () => {
    const d = draft({ enemyBans: [pick('Ahri')] });
    expect(mainChampion(player('A', 'MID', ['Ahri', 'Syndra']), d)?.id).toBe('Syndra');
    expect(mainChampion(player('A', 'MID', ['Ahri']), d)).toBeUndefined();
  });
});

describe('analyzeComposition', () => {
  const full = [
    player('A', 'TOP', ['Garen']),
    player('B', 'JUNGLE', ['Zed']),
    player('C', 'MID', ['Ahri']),
    player('D', 'ADC', ['Jinx']),
    player('E', 'SUPPORT', ['Lulu']),
  ];

  it('senza giocatori non ci sono suggerimenti', () => {
    expect(analyzeComposition([], champions)).toEqual([]);
  });

  it('segnala i ruoli scoperti', () => {
    const r = analyzeComposition(full.slice(0, 3), champions);
    expect(r.some((i) => i.text.includes('Support') && i.text.includes('ADC'))).toBe(true);
  });

  it('segnala un danno quasi tutto fisico', () => {
    const ad = [player('A', 'TOP', ['Garen']), player('B', 'JUNGLE', ['Zed']), player('D', 'ADC', ['Jinx'])];
    expect(analyzeComposition(ad, champions).some((i) => i.level === 'warn' && i.text.includes('fisico'))).toBe(true);
  });

  it('segnala un danno quasi tutto magico', () => {
    const ap = [player('A', 'MID', ['Syndra']), player('B', 'SUPPORT', ['Lux']), player('C', 'TOP', ['Ahri'])];
    expect(analyzeComposition(ap, champions).some((i) => i.level === 'warn' && i.text.includes('magico'))).toBe(true);
  });

  it('danno bilanciato e prima linea presente', () => {
    const r = analyzeComposition(full, champions);
    expect(r.some((i) => i.level === 'ok' && i.text.includes('bilanciato'))).toBe(true);
    expect(r.some((i) => i.level === 'ok' && i.text.includes('prima linea'))).toBe(true);
  });

  it('segnala l\'assenza di prima linea', () => {
    const squishy = [player('A', 'MID', ['Ahri']), player('B', 'ADC', ['Jinx']), player('C', 'SUPPORT', ['Lulu'])];
    expect(analyzeComposition(squishy, champions).some((i) => i.level === 'warn' && i.text.includes('prima linea'))).toBe(true);
  });

  it('avvisa quando un giocatore ha tutto il pool bannato o preso', () => {
    const d = draft({ enemyBans: [pick('Garen')] });
    const r = analyzeComposition(full, champions, d);
    expect(r.some((i) => i.level === 'warn' && i.text.startsWith('A non ha campioni disponibili'))).toBe(true);
  });

  it('usa il campione disponibile successivo nel calcolo', () => {
    const p = [player('A', 'TOP', ['Zed', 'Garen']), player('B', 'MID', ['Ahri']), player('C', 'ADC', ['Jinx'])];
    const d = draft({ allyBans: [pick('Zed')] });
    // Zed bannato: il principale di A diventa Garen, quindi c'è prima linea
    expect(analyzeComposition(p, champions, d).some((i) => i.level === 'ok' && i.text.includes('prima linea'))).toBe(true);
  });

  it('commenta il danno dei pick nemici', () => {
    const d = draft({ enemyPicks: [pick('Ahri'), pick('Lux'), pick('Syndra')] });
    expect(analyzeComposition(full, champions, d).some((i) => i.text.includes('resistenza magica'))).toBe(true);
    const d2 = draft({ enemyPicks: [pick('Zed'), pick('Jinx'), pick('Garen')] });
    expect(analyzeComposition(full, champions, d2).some((i) => i.text.includes('armatura'))).toBe(true);
  });

  it('ignora i campioni con punteggi tutti a 0 (dati mancanti in Data Dragon)', () => {
    const withZeros = [...champions, champ('Seraphine', ['Support', 'Mage'], 0, 0), champ('Vex', ['Mage'], 0, 0)];
    // Con Seraphine e Vex ignorati restano solo 2 campioni con dati: troppo pochi per giudicare il danno
    const p = [player('A', 'SUPPORT', ['Seraphine']), player('B', 'MID', ['Vex']), player('C', 'ADC', ['Jinx']), player('D', 'TOP', ['Garen'])];
    expect(analyzeComposition(p, withZeros).some((i) => i.text.toLowerCase().includes('danno'))).toBe(false);
    // Se invece ce ne sono abbastanza, la percentuale è calcolata solo su quelli con dati
    const q = [...p, player('E', 'JUNGLE', ['Zed'])];
    const r = analyzeComposition(q, withZeros);
    expect(r.some((i) => i.level === 'warn' && i.text.includes('fisico'))).toBe(true);
  });

  it('non fallisce se mancano tag o info', () => {
    const bare: Champion[] = [{ id: 'X', name: 'X', key: 'X', image: '' }];
    expect(() => analyzeComposition([player('A', 'TOP', ['X'])], bare, draft())).not.toThrow();
  });
});
