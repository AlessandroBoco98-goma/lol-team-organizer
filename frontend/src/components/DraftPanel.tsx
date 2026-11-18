import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setDraft } from "../lib/api";
import { championIcon } from "../lib/ddragon";
import { analyzeComposition } from "../lib/composition";
import {
  MAX_BANS,
  MAX_DRAFT_NOTES,
  MAX_ENEMY_PICKS,
  type Champion,
  type ChampionPick,
  type Draft,
  type Session,
  type SessionPlayer,
} from "../types";
import { Ban } from "lucide-react";
import { btnPrimary, input, label, panel, sectionTitle } from "../lib/styles";

const EMPTY_DRAFT: Draft = { allyBans: [], enemyBans: [], enemyPicks: [], notes: "" };

const LEVEL_STYLE = {
  ok: { icon: "✓", color: "#4fbf66" },
  warn: { icon: "!", color: "#f2a93b" },
  info: { icon: "i", color: "#3a9bdc" },
} as const;

function ChampionListEditor({
  title,
  items,
  max,
  champions,
  taken,
  onChange,
}: {
  title: string;
  items: ChampionPick[];
  max: number;
  champions: Champion[];
  taken: Set<string>; // campioni già usati in una delle tre liste
  onChange: (items: ChampionPick[]) => void;
}) {
  const full = items.length >= max;
  const available = champions.filter((c) => !taken.has(c.id));
  return (
    <div>
      <label className={label}>{title} ({items.length}/{max})</label>
      <div className="mb-2 flex min-h-8 flex-wrap gap-2">
        {items.map((c) => (
          <span
            key={c.id}
            className="animate-pop flex items-center gap-2 rounded-full border border-lol-gold/30 bg-[#010a13]/70 py-1 pl-1 pr-3 text-sm transition hover:border-lol-gold/60"
          >
            <img src={championIcon(c.id)} alt="" className="h-6 w-6 rounded-full ring-1 ring-lol-gold/40" />
            {c.name}
            <button
              type="button"
              onClick={() => onChange(items.filter((x) => x.id !== c.id))}
              className="text-lol-text/50 hover:text-red-400"
              aria-label={`Rimuovi ${c.name}`}
            >
              ×
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-sm text-lol-text/40">Nessuno</span>}
      </div>
      <select
        disabled={full}
        value=""
        onChange={(e) => {
          const champ = champions.find((c) => c.id === e.target.value);
          if (champ) onChange([...items, { id: champ.id, name: champ.name }]);
        }}
        className={input}
      >
        <option value="">{full ? `Limite di ${max} raggiunto` : "Aggiungi campione..."}</option>
        {available.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}

// Ban, pick nemici e note sugli avversari, con suggerimenti sulla composizione calcolati in tempo reale
export default function DraftPanel({
  session,
  players,
  champions,
}: {
  session: Session;
  players: SessionPlayer[];
  champions: Champion[];
}) {
  const queryClient = useQueryClient();
  const saved = session.draft ?? EMPTY_DRAFT;
  const [draft, setLocal] = useState<Draft>(saved);

  const sorted = [...champions].sort((a, b) => a.name.localeCompare(b.name, "it"));
  const taken = new Set([...draft.allyBans, ...draft.enemyBans, ...draft.enemyPicks].map((c) => c.id));
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const insights = analyzeComposition(players, champions, draft);

  const mutation = useMutation({
    mutationFn: () => setDraft(session.id, draft),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", session.id] });
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: () => alert("Impossibile salvare il draft. Controlla la password del team."),
  });

  return (
    <section className={`${panel} space-y-5`}>
      <h2 className={sectionTitle}>
        <Ban size={20} aria-hidden /> Draft
      </h2>

      <div className="grid gap-5 md:grid-cols-3">
        <ChampionListEditor
          title="Ban nostri"
          items={draft.allyBans}
          max={MAX_BANS}
          champions={sorted}
          taken={taken}
          onChange={(allyBans) => setLocal({ ...draft, allyBans })}
        />
        <ChampionListEditor
          title="Ban nemici"
          items={draft.enemyBans}
          max={MAX_BANS}
          champions={sorted}
          taken={taken}
          onChange={(enemyBans) => setLocal({ ...draft, enemyBans })}
        />
        <ChampionListEditor
          title="Pick nemici"
          items={draft.enemyPicks}
          max={MAX_ENEMY_PICKS}
          champions={sorted}
          taken={taken}
          onChange={(enemyPicks) => setLocal({ ...draft, enemyPicks })}
        />
      </div>

      <div>
        <label className={label}>Note sugli avversari</label>
        <textarea
          value={draft.notes}
          maxLength={MAX_DRAFT_NOTES}
          onChange={(e) => setLocal({ ...draft, notes: e.target.value })}
          placeholder="Es: il loro jungle fa invade al livello 1, il mid va sempre su roam..."
          className={`${input} min-h-24 resize-y`}
        />
      </div>

      {insights.length > 0 && (
        <div className="space-y-2 rounded-lg border border-lol-gold/15 bg-black/20 p-4">
          <h3 className="font-display text-sm uppercase tracking-widest text-lol-gold">Suggerimenti sulla composizione</h3>
          <ul className="space-y-1 text-sm">
            {insights.map((i, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="w-4 shrink-0 text-center font-bold" style={{ color: LEVEL_STYLE[i.level].color }}>
                  {LEVEL_STYLE[i.level].icon}
                </span>
                <span className="text-lol-text/80">{i.text}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-lol-text/40">
            Calcolati sul primo campione disponibile di ogni giocatore, con i dati di Data Dragon.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-3">
        {dirty && (
          <button type="button" onClick={() => setLocal(saved)} className="text-sm text-lol-text/60 hover:text-lol-gold">
            Annulla modifiche
          </button>
        )}
        <button type="button" onClick={() => mutation.mutate()} disabled={!dirty || mutation.isPending} className={btnPrimary}>
          {mutation.isPending ? "Salvo..." : "Salva draft"}
        </button>
      </div>
    </section>
  );
}
