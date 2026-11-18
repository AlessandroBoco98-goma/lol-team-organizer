import * as m from "motion/react-m";
import type { CSSProperties } from "react";
import { ROLE_COLORS, ROLE_LABELS, RSVP_COLORS, RSVP_LABELS, type Role } from "../types";
import { championIcon } from "../lib/ddragon";
import type { LobbySlot } from "../lib/utils";

const ROLE_ORDER: Role[] = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

// Cinque posti come nella selezione campioni: si riempiono quando i giocatori confermano.
// "full" per le pagine, "mini" per le card del calendario.
export default function Lobby({ slots, variant = "full" }: { slots: LobbySlot[]; variant?: "full" | "mini" }) {
  if (variant === "mini") {
    return (
      <div className="flex gap-1.5" role="img" aria-label={`${slots.filter((s) => s.name).length} posti su ${slots.length} occupati`}>
        {slots.map((s, i) => {
          const color = s.role ? ROLE_COLORS[s.role] : "#c9a96a";
          return (
            <span
              key={i}
              title={s.name ? `${s.name}${s.status ? ` · ${RSVP_LABELS[s.status]}` : ""}` : s.role ? `${ROLE_LABELS[s.role]} libero` : "Posto libero"}
              className="chamfer h-5 flex-1 transition-colors duration-500 [--c:6px]"
              style={{ backgroundColor: s.name ? color : "rgb(255 255 255 / 0.07)", opacity: s.name && s.status === "maybe" ? 0.55 : 1 }}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3">
      {slots.map((s, i) => {
        const filled = !!s.name;
        const color = s.role ? ROLE_COLORS[s.role] : "#c9a96a";
        const emptyLabel = s.role ? ROLE_LABELS[s.role] : ROLE_LABELS[ROLE_ORDER[i]];
        return (
          <m.div
            key={`${i}-${s.playerId ?? "vuoto"}`}
            initial={filled ? { opacity: 0, y: 10, scale: 0.92 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 26, delay: i * 0.07 }}
            style={{ "--edge-a": filled ? `${color}cc` : "rgb(255 255 255 / 0.12)", "--edge-b": filled ? `${color}33` : "rgb(255 255 255 / 0.04)", "--c": "10px" } as CSSProperties}
            className="panel flex min-w-0 flex-col items-center gap-2 px-1 py-3 text-center sm:px-2 sm:py-4"
          >
            <span className="text-[11px] font-semibold sm:text-xs" style={{ color: s.role ? color : undefined }}>
              {s.role ? ROLE_LABELS[s.role] : filled ? "In lobby" : "Libero"}
            </span>

            <div className="relative">
              {filled ? (
                s.championId ? (
                  <img
                    src={championIcon(s.championId)}
                    alt={s.championId}
                    className="h-11 w-11 rounded-full ring-2 sm:h-14 sm:w-14"
                    style={{ ["--tw-ring-color" as string]: color }}
                  />
                ) : (
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full font-display text-xl font-bold text-[#060a12] sm:h-14 sm:w-14 sm:text-2xl"
                    style={{ backgroundColor: color }}
                  >
                    {s.name!.trim().charAt(0).toUpperCase()}
                  </span>
                )
              ) : (
                <span className="flex h-11 w-11 animate-slot-pulse items-center justify-center rounded-full border border-dashed border-lol-mist/60 text-lol-mist sm:h-14 sm:w-14">
                  {emptyLabel.charAt(0)}
                </span>
              )}
              {s.status && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0b1424]"
                  style={{ backgroundColor: RSVP_COLORS[s.status] }}
                  title={RSVP_LABELS[s.status]}
                />
              )}
            </div>

            <span className={`w-full truncate text-xs sm:text-sm ${filled ? "font-medium" : "text-lol-mist"}`}>
              {filled ? s.name : s.role ? "Libero" : "In attesa"}
            </span>
          </m.div>
        );
      })}
    </div>
  );
}
