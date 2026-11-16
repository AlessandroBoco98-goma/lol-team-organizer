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
      className="rounded-sm border border-lol-gold-dark px-2 py-0.5 font-display text-xs uppercase tracking-widest text-lol-gold hover:bg-lol-gold/10"
    >
      op.gg
    </a>
  );
}
