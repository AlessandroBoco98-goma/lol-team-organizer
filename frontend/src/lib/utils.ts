import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ROLES, ROLE_LABELS, type Player, type Role, type RsvpStatus, type Session, type SessionPlayer } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('it-IT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTime(timeString: string): string {
  return timeString;
}

// Data di oggi in formato YYYY-MM-DD, nel fuso locale
export function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// Giorno, mese e giorno della settimana abbreviati per il badge data delle card
export function dateBadge(dateString: string): { day: string; month: string; weekday: string } {
  const d = new Date(`${dateString}T12:00:00`);
  return {
    day: String(d.getDate()),
    month: d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', ''),
    weekday: d.toLocaleDateString('it-IT', { weekday: 'short' }).replace('.', ''),
  };
}

// Tempo che manca alla sessione ("tra 2 ore", "Domani", "tra 5 giorni") o il suo stato se è già iniziata.
// La durata considerata per "In corso" è di 2 ore, come nell'evento di Google Calendar.
export function countdownLabel(s: Pick<Session, 'date' | 'time'>, now: Date = new Date()): string {
  const start = new Date(`${s.date}T${s.time}:00`);
  const diff = start.getTime() - now.getTime();
  if (diff <= 0) return now.getTime() < start.getTime() + 2 * 60 * 60 * 1000 ? 'In corso' : 'Conclusa';
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((dayStart(start) - dayStart(now)) / 86_400_000);
  if (dayDiff >= 2) return `tra ${dayDiff} giorni`;
  if (dayDiff === 1) return 'Domani';
  const minutes = Math.ceil(diff / 60_000);
  if (minutes < 60) return `tra ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? 'tra 1 ora' : `tra ${hours} ore`;
}

export function isPastSession(s: Pick<Session, 'date' | 'time'>): boolean {
  return new Date(`${s.date}T${s.time}:00`) < new Date();
}

// Unico campione il cui indirizzo su probuildstats.com non coincide con l'id di Data Dragon (verificato su 173 campioni)
const PROBUILD_SLUG_EXCEPTIONS: Record<string, string> = { MonkeyKing: 'wukong' };

// Pagina con le build dei pro per un campione su probuildstats.com; è un semplice link, nessun dato viene copiato
export function probuildUrl(championId: string): string {
  const slug = PROBUILD_SLUG_EXCEPTIONS[championId] ?? championId.toLowerCase();
  return `https://probuildstats.com/champion/${encodeURIComponent(slug)}`;
}

// Giocatore del roster corrispondente a un giocatore di sessione: per id, altrimenti (sessioni vecchie) per nome
export function findTeamPlayer(sp: Pick<SessionPlayer, 'name' | 'playerId'>, team: Player[]): Player | undefined {
  return (sp.playerId ? team.find((p) => p.id === sp.playerId) : undefined) ?? team.find((p) => p.name === sp.name);
}

// Aggiorna nome, Riot ID e regione di un giocatore di sessione con i dati attuali del roster.
// Se il giocatore non è più nel roster restano i dati salvati nella sessione.
export function resolveSessionPlayer(sp: SessionPlayer, team: Player[]): SessionPlayer {
  const t = findTeamPlayer(sp, team);
  if (!t) return sp;
  const { riotId: _riotId, region: _region, ...rest } = sp;
  return { ...rest, playerId: t.id, name: t.name, ...(t.riotId && t.region ? { riotId: t.riotId, region: t.region } : {}) };
}

export interface RsvpCounts {
  yes: number;
  maybe: number;
  no: number;
  pending: number;
}

// Risposta di un giocatore di sessione; undefined se non ha ancora risposto o non è nel roster
export function rsvpOf(session: Pick<Session, 'rsvp'>, sp: SessionPlayer, team: Player[]): RsvpStatus | undefined {
  const id = resolveSessionPlayer(sp, team).playerId;
  return id ? session.rsvp?.[id] : undefined;
}

// Conteggio delle risposte su tutto il roster: rispondono tutti, non solo chi è già nella composizione
export function rsvpCounts(session: Pick<Session, 'rsvp'>, team: Player[]): RsvpCounts {
  const counts: RsvpCounts = { yes: 0, maybe: 0, no: 0, pending: 0 };
  for (const p of team) {
    const status = session.rsvp?.[p.id];
    if (status) counts[status] += 1;
    else counts.pending += 1;
  }
  return counts;
}

export interface CountdownParts {
  total: number; // millisecondi rimanenti, mai negativi
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// Giorni, ore, minuti e secondi che mancano a un istante
export function countdownParts(target: Date, now: Date = new Date()): CountdownParts {
  const total = Math.max(0, target.getTime() - now.getTime());
  const s = Math.floor(total / 1000);
  return {
    total,
    days: Math.floor(s / 86_400),
    hours: Math.floor((s % 86_400) / 3_600),
    minutes: Math.floor((s % 3_600) / 60),
    seconds: s % 60,
  };
}

// Uno dei 5 posti della lobby: con il ruolo se la composizione è già fatta, altrimenti solo chi ha confermato
export interface LobbySlot {
  role?: Role;
  playerId?: string;
  name?: string;
  championId?: string;
  status?: RsvpStatus;
}

export function lobbySlots(session: Pick<Session, 'players' | 'rsvp'>, team: Player[]): LobbySlot[] {
  if (session.players.length > 0) {
    return ROLES.map((role) => {
      const raw = session.players.find((p) => p.role === role);
      if (!raw) return { role };
      const p = resolveSessionPlayer(raw, team);
      return {
        role,
        playerId: p.playerId,
        name: p.name,
        championId: p.champions[0]?.id,
        status: p.playerId ? session.rsvp?.[p.playerId] : undefined,
      };
    });
  }
  const yes = team.filter((p) => session.rsvp?.[p.id] === 'yes').slice(0, ROLES.length);
  return Array.from({ length: ROLES.length }, (_, i) =>
    yes[i] ? { playerId: yes[i].id, name: yes[i].name, status: 'yes' as const } : {},
  );
}

// Primo ruolo ancora libero
export function nextFreeRole(players: Pick<SessionPlayer, 'role'>[]): Role {
  const used = players.map((p) => p.role);
  return ROLES.find((r) => !used.includes(r)) ?? ROLES[0];
}

// Composizione costruita dai "Ci sono": chi è già in sessione e ha risposto sì resta com'è (ruolo e campioni),
// chi non ha risposto sì esce, i nuovi arrivano con il primo ruolo libero e senza campioni.
// Ritorna null se i "Ci sono" sono più dei ruoli disponibili.
export function playersFromRsvp(session: Pick<Session, 'players' | 'rsvp'>, team: Player[]): SessionPlayer[] | null {
  const yes = team.filter((p) => session.rsvp?.[p.id] === 'yes');
  if (yes.length > ROLES.length) return null;
  const result: SessionPlayer[] = [];
  const keep = session.players.map((sp) => resolveSessionPlayer(sp, team));
  for (const t of yes) {
    const existing = keep.find((sp) => sp.playerId === t.id);
    if (existing) result.push(existing);
  }
  for (const t of yes) {
    if (result.some((sp) => sp.playerId === t.id)) continue;
    result.push({
      playerId: t.id,
      name: t.name,
      role: nextFreeRole(result),
      champions: [],
      ...(t.riotId && t.region ? { riotId: t.riotId, region: t.region } : {}),
    });
  }
  return result;
}

// URL del profilo op.gg per un Riot ID "Nome#TAG"; null se mancano dati o il formato non è valido
export function opggUrl(riotId?: string, region?: string): string | null {
  if (!riotId || !region) return null;
  const [name, tag, ...rest] = riotId.split('#');
  if (!name || !tag || rest.length > 0) return null;
  return `https://www.op.gg/summoners/${encodeURIComponent(region.toLowerCase())}/${encodeURIComponent(name)}-${encodeURIComponent(tag)}`;
}

// Numero in formato internazionale senza spazi (+393331234567); '' se vuoto, null se non valido
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  let phone = trimmed.replace(/[\s().-]/g, '');
  if (phone.startsWith('00')) phone = `+${phone.slice(2)}`;
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

// Link che apre la chat WhatsApp con una persona, con il testo già scritto
export function whatsappChatUrl(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}

// Testo del messaggio con cui si invita il gruppo (o un singolo giocatore) a rispondere
export function sessionInviteText(session: Pick<Session, 'date' | 'time' | 'id'>, origin: string): string {
  return `🎮 Sessione LoL: ${formatDate(session.date)}, ore ${session.time}\nSegna la tua disponibilità qui: ${origin}/session/${session.id}`;
}

// Link che apre WhatsApp con il messaggio pronto da inviare al gruppo
export function whatsappShareUrl(session: Pick<Session, 'date' | 'time' | 'id'>, origin: string): string {
  return `https://wa.me/?text=${encodeURIComponent(sessionInviteText(session, origin))}`;
}

// Link che apre Google Calendar con l'evento precompilato (durata 2 ore)
export function googleCalendarUrl(session: Session): string {
  const start = new Date(`${session.date}T${session.time}:00`);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = session.players.map(
    (p) => `${p.name} (${ROLE_LABELS[p.role]}): ${p.champions.map((c) => c.name).join(', ') || '-'}`,
  );
  const details = session.notes ? `${lines.join('\n')}\n\n${session.notes}` : lines.join('\n');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Sessione LoL Team',
    dates: `${fmt(start)}/${fmt(end)}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
