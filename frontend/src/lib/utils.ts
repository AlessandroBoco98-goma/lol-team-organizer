import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ROLE_LABELS, type Session } from '../types';

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

export function isPastSession(s: Pick<Session, 'date' | 'time'>): boolean {
  return new Date(`${s.date}T${s.time}:00`) < new Date();
}

// URL del profilo op.gg per un Riot ID "Nome#TAG"; null se mancano dati o il formato non è valido
export function opggUrl(riotId?: string, region?: string): string | null {
  if (!riotId || !region) return null;
  const [name, tag, ...rest] = riotId.split('#');
  if (!name || !tag || rest.length > 0) return null;
  return `https://www.op.gg/summoners/${encodeURIComponent(region.toLowerCase())}/${encodeURIComponent(name)}-${encodeURIComponent(tag)}`;
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
