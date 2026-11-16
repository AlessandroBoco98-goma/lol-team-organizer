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

export interface Player {
  id: string;
  name: string;
  createdAt: string;
}

export interface ChampionPick {
  id: string;
  name: string;
}

export interface SessionPlayer {
  name: string;
  role: Role;
  champions: ChampionPick[];
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
