import { ROLES, ROLE_LABELS, type Champion, type ChampionPick, type Draft, type SessionPlayer } from '../types';

export type BlockReason = 'ally-ban' | 'enemy-ban' | 'enemy-pick';

export const BLOCK_LABELS: Record<BlockReason, string> = {
  'ally-ban': 'Bannato da noi',
  'enemy-ban': 'Bannato dal nemico',
  'enemy-pick': 'Preso dal nemico',
};

export interface Insight {
  level: 'ok' | 'warn' | 'info';
  text: string;
}

// Perché un campione non è giocabile in questo draft; null se è libero
export function blockReason(championId: string, draft?: Draft): BlockReason | null {
  if (!draft) return null;
  if (draft.allyBans.some((c) => c.id === championId)) return 'ally-ban';
  if (draft.enemyBans.some((c) => c.id === championId)) return 'enemy-ban';
  if (draft.enemyPicks.some((c) => c.id === championId)) return 'enemy-pick';
  return null;
}

// Campione principale di un giocatore: il primo del suo pool che non è bannato né preso dal nemico
export function mainChampion(player: Pick<SessionPlayer, 'champions'>, draft?: Draft): ChampionPick | undefined {
  return player.champions.find((c) => !blockReason(c.id, draft));
}

// Quota di danno magico su (fisico + magico) dei campioni indicati; null se mancano i dati
function magicShare(picks: ChampionPick[], byId: Map<string, Champion>): number | null {
  let attack = 0;
  let magic = 0;
  let known = 0;
  for (const p of picks) {
    const info = byId.get(p.id)?.info;
    // Alcuni campioni (es. Akshan, Rell, Seraphine, Vex) hanno i punteggi a 0 in Data Dragon: sono dati mancanti, non "nessun danno"
    if (!info || info.attack + info.magic === 0) continue;
    attack += info.attack;
    magic += info.magic;
    known += 1;
  }
  if (known < 3 || attack + magic === 0) return null;
  return magic / (attack + magic);
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

// Suggerimenti sulla composizione, calcolati sul campione principale di ogni giocatore
export function analyzeComposition(players: SessionPlayer[], champions: Champion[], draft?: Draft): Insight[] {
  const insights: Insight[] = [];
  if (players.length === 0) return insights;
  const byId = new Map(champions.map((c) => [c.id, c]));

  const missing = ROLES.filter((r) => !players.some((p) => p.role === r));
  if (missing.length > 0) {
    insights.push({ level: 'info', text: `Ruoli ancora scoperti: ${missing.map((r) => ROLE_LABELS[r]).join(', ')}.` });
  }

  const mains: ChampionPick[] = [];
  for (const p of players) {
    const main = mainChampion(p, draft);
    if (main) {
      mains.push(main);
    } else if (p.champions.length > 0) {
      insights.push({ level: 'warn', text: `${p.name} non ha campioni disponibili: tutti bannati o presi dal nemico.` });
    }
  }

  const share = magicShare(mains, byId);
  if (share !== null) {
    if (share < 0.25) {
      insights.push({ level: 'warn', text: `Danno quasi tutto fisico (${pct(1 - share)} AD): il nemico può contrastarlo con armatura.` });
    } else if (share > 0.75) {
      insights.push({ level: 'warn', text: `Danno quasi tutto magico (${pct(share)} AP): il nemico può contrastarlo con resistenza magica.` });
    } else {
      insights.push({ level: 'ok', text: `Danno bilanciato (${pct(1 - share)} AD / ${pct(share)} AP).` });
    }
  }

  const known = mains.filter((m) => byId.get(m.id)?.tags?.length);
  if (known.length >= 3) {
    const hasFrontline = known.some((m) => byId.get(m.id)!.tags!.some((t) => t === 'Tank' || t === 'Fighter'));
    insights.push(
      hasFrontline
        ? { level: 'ok', text: 'C\'è almeno un campione da prima linea (Tank o Fighter).' }
        : { level: 'warn', text: 'Nessun campione da prima linea (Tank o Fighter): attenzione agli ingaggi nemici.' },
    );
  }

  const enemyShare = draft ? magicShare(draft.enemyPicks, byId) : null;
  if (enemyShare !== null) {
    if (enemyShare > 0.65) {
      insights.push({ level: 'info', text: `Il nemico ha molto danno magico (${pct(enemyShare)}): considera resistenza magica.` });
    } else if (enemyShare < 0.35) {
      insights.push({ level: 'info', text: `Il nemico ha molto danno fisico (${pct(1 - enemyShare)}): considera armatura.` });
    }
  }

  return insights;
}
