import type { CSSProperties } from "react";
import { Flame } from "lucide-react";
import { championIcon } from "../lib/ddragon";
import { ROLES, ROLE_COLORS, ROLE_LABELS, type ProMeta, type Role } from "../types";
import { sectionTitle } from "../lib/styles";

// Meta dei tornei: i campioni più giocati per ruolo, con chi del roster li sa giocare.
// known[role] = id campione -> nomi dei giocatori che lo giocano in quel ruolo.
export default function ProMetaPanel({ meta, known }: { meta: ProMeta; known: Record<Role, Map<string, string[]>> }) {
  const top = (role: Role) =>
    Object.entries(meta.champions)
      .flatMap(([id, roles]) => (roles[role] ? [{ id, ...roles[role]! }] : []))
      .sort((a, b) => b.games - a.games || b.winRate - a.winRate)
      .slice(0, 5);

  return (
    <section className="space-y-4">
      <h2 className={sectionTitle}>
        <Flame size={20} aria-hidden /> Meta nei tornei
      </h2>
      <p className="max-w-2xl text-sm text-lol-mist">
        I campioni più giocati per ruolo nei tornei principali degli ultimi {meta.windowDays} giorni ({meta.games} partite). Il contorno oro
        indica un campione che qualcuno del roster sa giocare in quel ruolo.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ROLES.map((role) => {
          const color = ROLE_COLORS[role];
          return (
            <div key={role} className="panel space-y-3 p-4 [--c:10px]" style={{ "--edge-a": `${color}99`, "--edge-b": `${color}22` } as CSSProperties}>
              <p className="font-display text-xl font-bold leading-none" style={{ color }}>{ROLE_LABELS[role]}</p>
              <ul className="space-y-2">
                {top(role).map((c) => {
                  const who = known[role].get(c.id);
                  return (
                    <li key={c.id} className="flex items-center gap-2" title={who ? `Lo gioca: ${who.join(", ")}` : undefined}>
                      <img
                        src={championIcon(c.id)}
                        alt={c.id}
                        loading="lazy"
                        className={`h-8 w-8 rounded-md border ${who ? "border-lol-gold" : "border-white/10"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.id}</p>
                        <p className="tabular text-xs text-lol-mist">
                          {Math.round(c.pickRate * 100)}% pick · {Math.round(c.winRate * 100)}% vitt.
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-lol-mist">
        Dati:{" "}
        <a href={meta.sourceUrl} target="_blank" rel="noreferrer" className="underline">{meta.source}</a> ({meta.license}).
      </p>
    </section>
  );
}
