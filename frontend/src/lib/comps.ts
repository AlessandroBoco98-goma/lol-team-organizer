import { ROLES, ROLE_LABELS, type ChampionTraits, type ProMeta, type ProMetaStat, type RiotProfile, type Role, type TraitMap } from '../types';
import type { Insight } from './composition';

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));

// Un campione che il giocatore può giocare in un ruolo, con quanto ci è a suo agio (0-1)
export interface Candidate {
  championId: string;
  comfort: number;
  points: number;
  roleGames: number;
  // Tra i più giocati dal giocatore ma di un altro ruolo: il comfort è dimezzato
  offRole?: boolean;
  // Dati dei tornei per questo campione in questo ruolo
  meta?: ProMetaStat;
}

// Quanti dei campioni più usati di un giocatore entrano sempre nel suo insieme, anche fuori ruolo
const TOP_USED = 5;
const OFF_ROLE_FACTOR = 0.5;

// Tratti neutri per i campioni senza dati
const NEUTRAL: ChampionTraits = {
  damage: 1,
  durability: 1,
  crowdControl: 1,
  mobility: 1,
  utility: 1,
  damageType: 'mixed',
  positions: null,
  source: 'none',
};

// 1k punti di maestria ≈ 0, 10k ≈ 0.37, 100k ≈ 0.74, 500k ≈ 1
export function masteryScore(points: number): number {
  return clamp((Math.log10(points + 1) - 3) / 2.7);
}

// Cinque partite nel ruolo bastano per il massimo
export function gamesScore(games: number): number {
  return clamp(games / 5);
}

// I campioni giocabili da un giocatore in un ruolo, dal più comodo.
// Fonti: partite recenti nel ruolo e maestria. Un campione senza partite nel ruolo conta solo se il suo ruolo è
// compatibile (o sconosciuto). Il comfort pesa 60% maestria e 40% partite nel ruolo.
export function buildCandidates(
  profile: RiotProfile | undefined,
  role: Role,
  traits: TraitMap = {},
  max = 8,
  proMeta?: ProMeta | null,
): Candidate[] {
  if (!profile) return [];
  const byId = new Map<string, Candidate>();
  const entry = (id: string) => {
    let c = byId.get(id);
    if (!c) {
      c = { championId: id, comfort: 0, points: 0, roleGames: 0 };
      byId.set(id, c);
    }
    return c;
  };
  for (const c of profile.roles?.find((r) => r.role === role)?.champions ?? []) entry(c.championId).roleGames = c.games;
  for (const m of profile.mastery ?? []) entry(m.championId).points = m.points;

  const viable = (id: string) => {
    const positions = traits[id]?.positions;
    return !positions || positions.includes(role);
  };

  // I 5 campioni più usati (maestria e partite recenti) entrano sempre, anche se di un altro ruolo
  const topUsed = new Set<string>([
    ...[...(profile.mastery ?? [])].sort((a, b) => b.points - a.points).slice(0, TOP_USED).map((m) => m.championId),
    ...[...profile.champions].sort((a, b) => b.games - a.games).slice(0, TOP_USED).map((c) => c.championId),
  ]);
  for (const id of topUsed) entry(id);

  return [...byId.values()]
    .map((c) => {
      const inRole = c.roleGames > 0 || viable(c.championId);
      const offRole = !inRole && topUsed.has(c.championId);
      const base = 0.6 * masteryScore(c.points) + 0.4 * gamesScore(c.roleGames);
      return { ...c, offRole: offRole || undefined, comfort: offRole ? base * OFF_ROLE_FACTOR : base, inRole };
    })
    .filter((c) => (c.inRole || c.offRole) && c.comfort > 0)
    .map(({ inRole: _inRole, ...c }) => ({ ...c, meta: proMeta?.champions[c.championId]?.[role] }))
    .sort((a, b) => b.comfort - a.comfort || a.championId.localeCompare(b.championId))
    .slice(0, max);
}

export interface CompBreakdown {
  comfort: number;
  mix: number;
  front: number;
  control: number;
  mobility: number;
  // Forza in meta nei tornei (0-1), null se il meta non è disponibile
  meta: number | null;
  // Quota di danno fisico, null se non ci sono campioni
  adShare: number | null;
}

interface Slot {
  championId?: string;
  comfort: number;
  // Dati dei tornei per il campione nel ruolo dello slot
  meta?: ProMetaStat;
}

// Punteggio 0-1 di una comp: comfort dei giocatori e equilibrio (danno AD/AP, prima linea, controllo, mobilità).
// Con il meta dei tornei disponibile pesa anche quello (11%); senza, i pesi sono quelli di base.
export function scoreComp(slots: Slot[], traits: TraitMap = {}, hasMeta = false): { score: number; breakdown: CompBreakdown } {
  const picked = slots.filter((s): s is Slot & { championId: string } => !!s.championId);
  const comfort = slots.length > 0 ? slots.reduce((n, s) => n + s.comfort, 0) / slots.length : 0;
  if (picked.length === 0) {
    return { score: 0.5 * comfort, breakdown: { comfort, mix: 0, front: 0, control: 0, mobility: 0, meta: null, adShare: null } };
  }
  const meta = hasMeta ? picked.reduce((n, s) => n + (s.meta?.score ?? 0), 0) / picked.length : null;

  let ad = 0;
  let ap = 0;
  let durability = 0;
  let control = 0;
  let mobility = 0;
  for (const s of picked) {
    const t = traits[s.championId] ?? NEUTRAL;
    const weight = Math.max(1, t.damage);
    if (t.damageType === 'physical') ad += weight;
    else if (t.damageType === 'magic') ap += weight;
    else {
      ad += weight / 2;
      ap += weight / 2;
    }
    durability += t.durability;
    control += t.crowdControl;
    mobility += t.mobility;
  }
  const adShare = ad + ap > 0 ? ad / (ad + ap) : null;
  const mix = adShare === null ? 0 : 1 - clamp((Math.abs(adShare - 0.5) - 0.2) / 0.3);
  const front = clamp((durability - 3) / 5);
  const controlScore = clamp((control - 4) / 5);
  const mobilityScore = clamp((mobility - 3) / 4);

  const score =
    meta === null
      ? 0.5 * comfort + 0.18 * mix + 0.14 * front + 0.12 * controlScore + 0.06 * mobilityScore
      : 0.46 * comfort + 0.16 * mix + 0.12 * front + 0.1 * controlScore + 0.05 * mobilityScore + 0.11 * meta;
  return { score, breakdown: { comfort, mix, front, control: controlScore, mobility: mobilityScore, meta, adShare } };
}

export interface CompPlayer {
  playerId?: string;
  name: string;
  role: Role;
  candidates: Candidate[];
}

export interface CompPick {
  role: Role;
  playerId?: string;
  name: string;
  championId?: string;
  comfort: number;
  offRole?: boolean;
  meta?: ProMetaStat;
}

export interface Comp {
  picks: CompPick[];
  score: number;
  breakdown: CompBreakdown;
  notes: Insight[];
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

// Spiega in parole i punti di forza e di debolezza di una comp
function describe(picks: CompPick[], breakdown: CompBreakdown, names: (id: string) => string = (id) => id): Insight[] {
  const notes: Insight[] = [];
  const offRole = picks.filter((p) => p.offRole && p.championId);
  if (offRole.length > 0) {
    notes.push({ level: 'info', text: `Fuori ruolo: ${offRole.map((p) => `${names(p.championId!)} (${p.name})`).join(', ')}.` });
  }
  if (breakdown.meta !== null) {
    const top = picks
      .filter((p) => p.championId && p.meta && p.meta.pickRate >= 0.05)
      .sort((a, b) => b.meta!.pickRate - a.meta!.pickRate)[0];
    if (top) notes.push({ level: 'ok', text: `Meta pro: ${names(top.championId!)} (${pct(top.meta!.pickRate)} di pick, ${pct(top.meta!.winRate)} di vittorie).` });
    else if (breakdown.meta < 0.1) notes.push({ level: 'info', text: 'Nessun pick di questa comp è presente nel meta dei tornei.' });
  }
  const empty = picks.filter((p) => !p.championId);
  if (empty.length > 0) {
    notes.push({ level: 'warn', text: `Nessun dato per ${empty.map((p) => p.name).join(', ')}: il pick va scelto a mano.` });
  }
  const comfortable = picks.filter((p) => p.championId && p.comfort >= 0.5).length;
  const total = picks.filter((p) => p.championId).length;
  if (total > 0) {
    notes.push(
      comfortable === total
        ? { level: 'ok', text: 'Tutti su campioni che giocano spesso.' }
        : comfortable === 0
          ? { level: 'warn', text: 'Campioni poco giocati: possono servire partite di prova.' }
          : { level: 'info', text: `${comfortable} su ${total} giocano un campione molto giocato.` },
    );
  }
  if (breakdown.adShare !== null) {
    const ad = breakdown.adShare;
    if (ad > 0.8) notes.push({ level: 'warn', text: `Danno quasi tutto fisico (${pct(ad)}): facile da contrastare con armatura.` });
    else if (ad < 0.2) notes.push({ level: 'warn', text: `Danno quasi tutto magico (${pct(1 - ad)}): facile da contrastare con resistenza magica.` });
    else notes.push({ level: 'ok', text: `Danno bilanciato (${pct(ad)} AD / ${pct(1 - ad)} AP).` });
  }
  if (breakdown.front < 0.25) notes.push({ level: 'warn', text: 'Poca prima linea: attenzione agli ingaggi nemici.' });
  else if (breakdown.front >= 0.6) notes.push({ level: 'ok', text: 'Buona prima linea.' });
  if (breakdown.control < 0.2) notes.push({ level: 'info', text: 'Poco controllo (stun, root, slow).' });
  else if (breakdown.control >= 0.6) notes.push({ level: 'ok', text: 'Molto controllo.' });
  return notes;
}

// Le migliori comp che si possono formare con i campioni di ciascun giocatore. Si provano tutte le combinazioni
// (al massimo 5 candidati per giocatore), senza doppioni di campione. Le comp proposte sono diverse tra loro:
// ciascuna cambia almeno 2 pick rispetto alle precedenti, se possibile.
export function proposeComps(
  players: CompPlayer[],
  traits: TraitMap = {},
  options: { count?: number; perRole?: number; hasMeta?: boolean; names?: (id: string) => string } = {},
): Comp[] {
  const { count = 3, perRole = 6, hasMeta = false, names } = options;
  if (players.length === 0) return [];

  const options5 = players.map((p) => (p.candidates.length > 0 ? p.candidates.slice(0, perRole) : [null]));
  const found: { picks: CompPick[]; score: number; breakdown: CompBreakdown }[] = [];
  const chosen: (Candidate | null)[] = [];
  const used = new Set<string>();

  const toPicks = () =>
    players.map((p, i): CompPick => ({
      role: p.role,
      playerId: p.playerId,
      name: p.name,
      championId: chosen[i]?.championId,
      comfort: chosen[i]?.comfort ?? 0,
      offRole: chosen[i]?.offRole,
      meta: chosen[i]?.meta,
    }));

  function walk(i: number) {
    if (i === players.length) {
      const picks = toPicks();
      const { score, breakdown } = scoreComp(picks, traits, hasMeta);
      found.push({ picks, score, breakdown });
      return;
    }
    for (const cand of options5[i]) {
      if (cand && used.has(cand.championId)) continue;
      chosen[i] = cand;
      if (cand) used.add(cand.championId);
      walk(i + 1);
      if (cand) used.delete(cand.championId);
    }
  }
  walk(0);

  found.sort((a, b) => b.score - a.score);
  const diff = (a: CompPick[], b: CompPick[]) => a.filter((p, i) => p.championId !== b[i].championId).length;

  const selected: typeof found = [];
  for (const minDiff of [2, 1]) {
    for (const f of found) {
      if (selected.length >= count) break;
      if (selected.includes(f)) continue;
      if (selected.every((s) => diff(s.picks, f.picks) >= minDiff)) selected.push(f);
    }
  }
  selected.sort((a, b) => b.score - a.score);
  return selected.map((s) => ({ ...s, notes: describe(s.picks, s.breakdown, names) }));
}

export interface RoleCoverage {
  role: Role;
  // Chi può giocare il ruolo, dal più comodo
  players: { playerId: string; name: string; best: Candidate; depth: number }[];
}

// Per ogni ruolo, chi del roster lo gioca davvero (campione più comodo almeno 0.25) e quanti campioni ha a disposizione.
// Un ruolo con nessuno è un "buco" del roster.
export function roleCoverage(
  roster: { playerId: string; name: string; profile?: RiotProfile }[],
  traits: TraitMap = {},
): RoleCoverage[] {
  return ROLES.map((role) => ({
    role,
    players: roster
      .map((r) => {
        // I campioni fuori ruolo non contano per la copertura
        const candidates = buildCandidates(r.profile, role, traits, 10).filter((c) => !c.offRole);
        return { playerId: r.playerId, name: r.name, best: candidates[0], depth: candidates.filter((c) => c.comfort >= 0.25).length };
      })
      .filter((x): x is RoleCoverage['players'][number] => !!x.best && x.best.comfort >= 0.25)
      .sort((a, b) => b.best.comfort - a.best.comfort),
  }));
}

export const roleGapLabel = (coverage: RoleCoverage[]): string | null => {
  const gaps = coverage.filter((c) => c.players.length === 0).map((c) => ROLE_LABELS[c.role]);
  return gaps.length > 0 ? gaps.join(', ') : null;
};
