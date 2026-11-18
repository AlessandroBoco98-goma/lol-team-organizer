// Loader a rombo con bagliore, in tema con il logo
export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-24" role="status" aria-label="Caricamento">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-lol-gold/15 border-t-lol-gold shadow-[0_0_24px_-4px_rgb(200_170_110/0.6)]" />
        <div className="absolute inset-3 rotate-45 animate-pulse-glow rounded-[3px] border border-lol-teal/70" />
      </div>
      <p className="font-display text-xs uppercase tracking-[0.35em] text-lol-text/40">Caricamento</p>
    </div>
  );
}
