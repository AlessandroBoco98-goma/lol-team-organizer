import { describe, expect, it } from 'vitest';
import { formatDuration, formatRank, kdaRatio, timeAgo, winRate } from './riot';

describe('formatRank', () => {
  it('traduce la lega e aggiunge la divisione', () => {
    expect(formatRank({ tier: 'GOLD', rank: 'II' })).toBe('Oro II');
    expect(formatRank({ tier: 'EMERALD', rank: 'IV' })).toBe('Smeraldo IV');
  });

  it('le leghe alte non hanno divisione', () => {
    expect(formatRank({ tier: 'MASTER', rank: 'I' })).toBe('Maestro');
    expect(formatRank({ tier: 'CHALLENGER', rank: 'I' })).toBe('Sfidante');
  });

  it('lascia invariata una lega sconosciuta', () => {
    expect(formatRank({ tier: 'NUOVA', rank: 'I' })).toBe('NUOVA I');
  });
});

describe('winRate / kdaRatio', () => {
  it('calcola la percentuale e gestisce zero partite', () => {
    expect(winRate(3, 4)).toBe(75);
    expect(winRate(1, 3)).toBe(33);
    expect(winRate(0, 0)).toBe(0);
  });

  it('calcola il KDA senza dividere per zero', () => {
    expect(kdaRatio(5, 2, 7)).toBe(6);
    expect(kdaRatio(4, 0, 6)).toBe(10);
    expect(kdaRatio(1, 3, 1)).toBe(0.67);
  });
});

describe('timeAgo / formatDuration', () => {
  const now = 10_000_000_000;
  it('esprime il tempo trascorso', () => {
    expect(timeAgo(now - 30_000, now)).toBe('adesso');
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5 min fa');
    expect(timeAgo(now - 60 * 60_000, now)).toBe('1 ora fa');
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('3 ore fa');
    expect(timeAgo(now - 24 * 3_600_000, now)).toBe('1 giorno fa');
    expect(timeAgo(now - 5 * 86_400_000, now)).toBe('5 giorni fa');
  });

  it('non va in negativo con un orario nel futuro', () => {
    expect(timeAgo(now + 60_000, now)).toBe('adesso');
  });

  it('formatta la durata della partita', () => {
    expect(formatDuration(1710)).toBe('28:30');
    expect(formatDuration(65)).toBe('1:05');
  });
});
