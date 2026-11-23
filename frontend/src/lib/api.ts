import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { Session, SessionPlayer, SessionStatus, Champion, Draft, Player, Region, RiotProfile, RsvpStatus } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const PASSWORD_KEY = 'lol-team-password';

const api = axios.create({ baseURL: API_URL });

// Ogni richiesta porta la password del team, se salvata
api.interceptors.request.use((config) => {
  const password = localStorage.getItem(PASSWORD_KEY);
  if (password) config.headers.set('x-team-password', password);
  return config;
});

// Se il server risponde 401 chiede la password e ripete la richiesta una volta
api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
  if (error.response?.status === 401 && config && !config._retried) {
    const password = window.prompt('Password del team per modificare i dati:');
    if (password) {
      localStorage.setItem(PASSWORD_KEY, password);
      config._retried = true;
      return api.request(config);
    }
  }
  return Promise.reject(error);
});

// Le sessioni create con la versione precedente hanno `champion` (stringa) al posto di `champions`
function normalizeSession(raw: any): Session {
  return {
    ...raw,
    players: (raw.players ?? []).map((p: any) => ({
      ...(p.playerId ? { playerId: p.playerId } : {}),
      name: p.name,
      role: p.role,
      ...(p.riotId && p.region ? { riotId: p.riotId, region: p.region } : {}),
      champions: Array.isArray(p.champions)
        ? p.champions
        : p.champion
          ? [{ id: String(p.champion).replace(/\s/g, ''), name: String(p.champion) }]
          : [],
    })),
  };
}

type SessionInput = { date: string; time: string; players: SessionPlayer[]; notes?: string };

// Sessions API
export const getSessions = async (): Promise<Session[]> => {
  const response = await api.get('/api/sessions');
  return response.data.map(normalizeSession);
};

export const getSession = async (id: string): Promise<Session> => {
  const response = await api.get(`/api/sessions/${id}`);
  return normalizeSession(response.data);
};

export const createSession = async (sessionData: SessionInput): Promise<Session> => {
  const response = await api.post('/api/sessions', sessionData);
  return response.data;
};

export const updateSession = async (id: string, sessionData: SessionInput): Promise<Session> => {
  const response = await api.put(`/api/sessions/${id}`, sessionData);
  return response.data;
};

// status null annulla la risposta del giocatore
export interface RsvpResult {
  // true se questo voto ha portato una proposta alle conferme necessarie e l'ha resa una sessione vera
  confirmedNow: boolean;
  sessionStatus: SessionStatus;
}

export const setRsvp = async (sessionId: string, playerId: string, status: RsvpStatus | null): Promise<RsvpResult> => {
  const response = await api.put(`/api/sessions/${sessionId}/rsvp`, { playerId, status });
  return { confirmedNow: !!response.data.confirmedNow, sessionStatus: response.data.sessionStatus ?? 'confirmed' };
};

export interface AutofillResult {
  players: SessionPlayer[];
  // Nomi dei giocatori senza dati Riot utilizzabili: entrano in squadra ma senza campioni
  withoutData: string[];
  // false se sul server non c'è la chiave Riot
  riotEnabled: boolean;
}

// Compila la squadra con chi ha votato "Ci sono": ruolo abituale e campioni più giocati dall'account Riot
export const autofillSession = async (sessionId: string): Promise<AutofillResult> => {
  const response = await api.post(`/api/sessions/${sessionId}/autofill`);
  return response.data;
};

export const setDraft = async (sessionId: string, draft: Draft): Promise<Draft> => {
  const response = await api.put(`/api/sessions/${sessionId}/draft`, draft);
  return response.data.draft;
};

export const deleteSession = async (id: string): Promise<void> => {
  await api.delete(`/api/sessions/${id}`);
};

// Players API
export const getPlayers = async (): Promise<Player[]> => {
  const response = await api.get('/api/players');
  return response.data;
};

// phone: stringa vuota rimuove il numero, campo assente lo lascia com'è
type PlayerInput = { name: string; riotId?: string; region?: Region; phone?: string };

export const createPlayer = async (playerData: PlayerInput): Promise<Player> => {
  const response = await api.post('/api/players', playerData);
  return response.data;
};

export const updatePlayer = async (id: string, playerData: PlayerInput): Promise<Player> => {
  const response = await api.put(`/api/players/${id}`, playerData);
  return response.data;
};

export const deletePlayer = async (id: string): Promise<void> => {
  await api.delete(`/api/players/${id}`);
};

// Statistiche Riot di un giocatore: il backend richiede la password del team e può rispondere 503 se manca la chiave Riot
export const getPlayerRiot = async (playerId: string): Promise<RiotProfile> => {
  const response = await api.get(`/api/players/${playerId}/riot`);
  return response.data;
};

// Messaggio d'errore leggibile da una risposta del backend
export function apiErrorMessage(error: unknown, fallback: string): string {
  return (error as AxiosError<{ error?: string }>)?.response?.data?.error ?? fallback;
}

// Champions API
export const getChampions = async (version?: string, locale?: string): Promise<Champion[]> => {
  const response = await api.get('/api/champions', { params: { version, locale } });
  return response.data;
};

// Health check
export const healthCheck = async () => {
  const response = await api.get('/api/health');
  return response.data;
};
