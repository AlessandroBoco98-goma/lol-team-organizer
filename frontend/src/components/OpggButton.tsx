import { ExternalLink } from "lucide-react";
import { opggUrl } from "../lib/utils";

// Pulsante verso il profilo op.gg; non viene mostrato se riotId o regione mancano
export default function OpggButton({ riotId, region }: { riotId?: string; region?: string }) {
  const url = opggUrl(riotId, region);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={`Profilo op.gg di ${riotId}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-lol-blue/50 bg-lol-blue/10 px-2.5 py-0.5 font-display text-[11px] uppercase tracking-widest text-lol-blue transition hover:-translate-y-0.5 hover:bg-lol-blue/20"
    >
      op.gg <ExternalLink size={11} aria-hidden />
    </a>
  );
}
