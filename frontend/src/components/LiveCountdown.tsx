import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { countdownParts } from "../lib/utils";

// Orologio condiviso: aggiorna una volta al secondo finché il componente è montato
function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Unit({ value, label, animate = false }: { value: number; label: string; animate?: boolean }) {
  const text = String(value).padStart(2, "0");
  return (
    <div className="flex min-w-[3.2rem] flex-col items-center sm:min-w-[4.4rem]">
      <div className="relative h-[3.2rem] overflow-hidden sm:h-[4.6rem]">
        {animate ? (
          // Solo i secondi scorrono verso l'alto a ogni tick: è l'unico movimento continuo dell'hero
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span
              key={text}
              initial={{ y: "70%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-70%", opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="tabular block font-display text-[3.2rem] font-extrabold leading-none text-lol-gold-bright sm:text-[4.6rem]"
            >
              {text}
            </m.span>
          </AnimatePresence>
        ) : (
          <span className="tabular block font-display text-[3.2rem] font-extrabold leading-none text-lol-gold-bright sm:text-[4.6rem]">
            {text}
          </span>
        )}
      </div>
      <span className="mt-1 text-xs text-lol-mist">{label}</span>
    </div>
  );
}

// Conto alla rovescia dal vivo fino all'inizio della sessione
export default function LiveCountdown({ target }: { target: Date }) {
  const now = useNow();
  const { days, hours, minutes, seconds, total } = countdownParts(target, now);

  if (total === 0) {
    return <p className="font-display text-5xl font-extrabold text-lol-teal sm:text-6xl">Si parte</p>;
  }

  return (
    <div className="flex items-start gap-1 sm:gap-2" role="timer" aria-label={`${days} giorni, ${hours} ore, ${minutes} minuti`}>
      {days > 0 && (
        <>
          <Unit value={days} label={days === 1 ? "giorno" : "giorni"} />
          <span className="pt-1 font-display text-4xl text-lol-gold/40 sm:pt-2 sm:text-5xl">:</span>
        </>
      )}
      <Unit value={hours} label={hours === 1 ? "ora" : "ore"} />
      <span className="pt-1 font-display text-4xl text-lol-gold/40 sm:pt-2 sm:text-5xl">:</span>
      <Unit value={minutes} label="minuti" />
      <span className="pt-1 font-display text-4xl text-lol-gold/40 sm:pt-2 sm:text-5xl">:</span>
      <Unit value={seconds} label="secondi" animate />
    </div>
  );
}
