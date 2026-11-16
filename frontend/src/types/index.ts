export type Role = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT';

export const ROLES: Role[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

export const ROLE_LABELS: Record<Role, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MID: 'Mid',
  ADC: 'ADC',
  SUPPORT: 'Support',
};

export const ROLE_COLORS: Record<Role, string> = {
  TOP: '#e84057',
  JUNGLE: '#4fbf66',
  MID: '#3a9bdc',
  ADC: '#f2a93b',
  SUPPORT: '#0ac8b9',
};

export const MAX_CHAMPIONS = 3;

export const REGIONS = ['EUW', 'EUNE', 'NA', 'KR', 'BR', 'LAN', 'LAS', 'OCE', 'TR', 'RU', 'JP'] as const;

export type Region = (typeof REGIONS)[number];

// Formato "Nome#TAG": nome 3-16 caratteri senza #, tag 3-5 caratteri alfanumerici
export const RIOT_ID_REGEX = /^[^#]{3,16}#[A-Za-z0-9]{3,5}$/;

export interface Player {
  id: string;
  name: string;
  riotId?: string;
  region?: Region;
  createdAt: string;
}

export interface ChampionPick {
  id: string;
  name: string;
}

export interface SessionPlayer {
  // Riferimento al giocatore del roster; opzionale perché assente nelle sessioni vecchie
  playerId?: string;
  name: string;
  role: Role;
  champions: ChampionPick[];
  riotId?: string;
  region?: Region;
}

export interface Session {
  id: string;
  date: string;
  time: string;
  players: SessionPlayer[];
  notes: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Champion {
  id: string;
  name: string;
  key: string;
  image: string;
}
