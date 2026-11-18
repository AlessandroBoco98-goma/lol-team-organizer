import { lazy, Suspense, useState } from "react";
import { Activity } from "lucide-react";

// La finestra si scarica solo al primo clic: porta con sé la finestra modale e le chiamate a Data Dragon
const RiotStatsModal = lazy(() => import("./RiotStatsModal"));

// Apre le statistiche Riot del giocatore; compare solo se è nel roster e ha Riot ID e regione
export default function RiotStatsButton({
  playerId,
  name,
  riotId,
  region,
}: {
  playerId?: string;
  name: string;
  riotId?: string;
  region?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!playerId || !riotId || !region) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Rank, ultime partite e build di ${name}`}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-lol-teal/50 bg-lol-teal/10 px-2.5 py-0.5 text-xs font-medium text-lol-teal transition hover:-translate-y-0.5 hover:bg-lol-teal/20"
      >
        <Activity size={11} aria-hidden /> Stats
      </button>
      {open && (
        <Suspense fallback={null}>
          <RiotStatsModal playerId={playerId} name={name} riotId={riotId} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
