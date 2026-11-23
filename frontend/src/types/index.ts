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
  // Numero internazionale (+39...): il backend lo invia solo a chi ha la password del team
  phone?: string;
  // true se il numero esiste ma il backend non l'ha inviato (password non ancora inserita)
  hasPhone?: boolean;
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

// Statistiche dalla Riot API (calcolate dal backend)
export interface RiotRank {
  queue: 'solo' | 'flex';
  tier: string;
  rank: string;
  lp: number;
  wins: number;
  losses: number;
}

export interface RiotMatch {
  matchId: string;
  championId: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  items: number[];
  keystone: number | null;
  role: string;
  cs: number;
  durationSec: number;
  endedAt: number;
}

export interface RiotChampionStat {
  championId: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  topItems: number[];
  keystone: number | null;
}

// Maestria su un campione (Champion-Mastery-V4)
export interface RiotMastery {
  championId: string;
  level: number;
  points: number;
  lastPlayedAt: number | null;
}

// Tratti di un campione per le comp (backend: Community Dragon + Meraki). I numeri vanno da 0 a 3.
export interface ChampionTraits {
  damage: number;
  durability: number;
  crowdControl: number;
  mobility: number;
  utility: number;
  damageType: 'physical' | 'magic' | 'mixed';
  // Ruoli in cui si gioca; null se non noti
  positions: Role[] | null;
  source: string;
}

export type TraitMap = Record<string, ChampionTraits>;

// Meta dei tornei professionistici (backend: Leaguepedia, CC BY-SA 3.0): per campione e ruolo
export interface ProMetaStat {
  games: number;
  wins: number;
  pickRate: number;
  winRate: number;
  score: number;
}

export interface ProMeta {
  updatedAt: string;
  windowDays: number;
  games: number;
  tournaments: string[];
  source: string;
  sourceUrl: string;
  license: string;
  champions: Record<string, Partial<Record<Role, ProMetaStat>>>;
}

// Partite e campioni giocati in un ruolo (ruoli dell'app)
export interface RiotRoleStat {
  role: Role;
  games: number;
  champions: { championId: string; games: number }[];
}

export interface RiotProfile {
  riotId: string;
  region: string;
  ranks: RiotRank[];
  recent: RiotMatch[];
  champions: RiotChampionStat[];
  roles?: RiotRoleStat[];
  mastery?: RiotMastery[];
  gamesAnalyzed: number;
  updatedAt: string;
}

export const MAX_BANS = 5;

// Draft di una sessione: i nostri ban
export interface Draft {
  allyBans: ChampionPick[];
}

// Conferme ("Ci sono") necessarie perché un giorno proposto diventi una sessione vera; uguale a CONFIRM_THRESHOLD del backend
export const CONFIRM_THRESHOLD = 3;

export type SessionStatus = 'proposal' | 'confirmed';

export type RsvpStatus = 'yes' | 'maybe' | 'no';

export const RSVP_STATUSES: RsvpStatus[] = ['yes', 'maybe', 'no'];

export const RSVP_LABELS: Record<RsvpStatus, string> = {
  yes: 'Ci sono',
  maybe: 'Forse',
  no: 'Non ci sono',
};

export const RSVP_COLORS: Record<RsvpStatus, string> = {
  yes: '#4fbf66',
  maybe: '#f2a93b',
  no: '#e84057',
};

export interface Session {
  id: string;
  date: string;
  time: string;
  players: SessionPlayer[];
  notes: string;
  // Disponibilità per id del giocatore nel roster; opzionale, assente nelle sessioni vecchie
  rsvp?: Record<string, RsvpStatus>;
  // I nostri ban; opzionale, assente nelle sessioni vecchie
  draft?: Draft;
  // 'proposal': giorno proposto dalla votazione settimanale, non ancora nel calendario.
  // Assente o 'confirmed': sessione vera (create a mano, o proposte che hanno raggiunto le conferme).
  status?: SessionStatus;
  // 'weekly' per i giorni creati dalla generazione settimanale
  source?: 'weekly';
  // Quando la proposta è diventata sessione vera (ISO)
  confirmedAt?: string;
  // Ruolo scelto da ciascuno votando "Ci sono", per id del giocatore
  voteRoles?: Record<string, Role>;
  // Esito dell'ultima compilazione automatica della squadra: spiega perché mancano i campioni
  autoFillReport?: { at: string; riotEnabled: boolean; withoutData: string[] };
  createdAt: string;
  updatedAt?: string;
}

export interface Champion {
  id: string;
  name: string;
  key: string;
  image: string;
  // Da Data Dragon: classi (Fighter, Mage, Tank...) e punteggi 0-10 di attacco, difesa, magia, difficoltà
  tags?: string[];
  info?: { attack: number; defense: number; magic: number; difficulty: number } | null;
}
