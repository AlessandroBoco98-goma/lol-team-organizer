import type { RiotRank } from '../types';

const TIER_LABELS: Record<string, string> = {
  IRON: 'Ferro',
  BRONZE: 'Bronzo',
  SILVER: 'Argento',
  GOLD: 'Oro',
  PLATINUM: 'Platino',
  EMERALD: 'Smeraldo',
  DIAMOND: 'Diamante',
  MASTER: 'Maestro',
  GRANDMASTER: 'Grand Maestro',
  CHALLENGER: 'Sfidante',
};

export const TIER_COLORS: Record<string, string> = {
  IRON: '#8b8680',
  BRONZE: '#b0764a',
  SILVER: '#a9b7c3',
  GOLD: '#e0b94a',
  PLATINUM: '#4fb6a8',
  EMERALD: '#2fbf71',
  DIAMOND: '#6f9bff',
  MASTER: '#b36bff',
  GRANDMASTER: '#ff6b6b',
  CHALLENGER: '#7fd8ff',
};

const APEX_TIERS = ['MASTER', 'GRANDMASTER', 'CHALLENGER'];

// "Oro II" oppure "Maestro" (le leghe alte non hanno divisioni)
export function formatRank(r: Pick<RiotRank, 'tier' | 'rank'>): string {
  const tier = TIER_LABELS[r.tier] ?? r.tier;
  return APEX_TIERS.includes(r.tier) ? tier : `${tier} ${r.rank}`;
}

// Percentuale di vittorie, 0 se non ci sono partite
export function winRate(wins: number, games: number): number {
  return games > 0 ? Math.round((wins / games) * 100) : 0;
}

// (uccisioni + assist) / morti, con le morti a 1 come minimo per evitare la divisione per zero
export function kdaRatio(kills: number, deaths: number, assists: number): number {
  return Math.round(((kills + assists) / Math.max(1, deaths)) * 100) / 100;
}

// "5 min fa", "3 ore fa", "2 giorni fa"
export function timeAgo(timestampMs: number, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - timestampMs) / 60_000));
  if (minutes < 60) return minutes <= 1 ? 'adesso' : `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 ora fa' : `${hours} ore fa`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 giorno fa' : `${days} giorni fa`;
}

// "28:30"
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
