// Pulsanti: forma smussata (stesso taglio dei pannelli, più piccolo), testo con la sola iniziale maiuscola
const btnBase =
  'chamfer inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold transition duration-200 disabled:pointer-events-none disabled:opacity-40 [--c:9px]';

export const btnPrimary = `${btnBase} bg-linear-to-b from-[#ecd9a8] via-[#d2b676] to-[#a58545] text-[#0a0f18] hover:brightness-110 active:brightness-95`;

// Il bordo dei pulsanti secondari è un'ombra interna: il clip-path taglierebbe un bordo normale agli angoli
export const btnGhost = `${btnBase} bg-white/[0.03] text-lol-gold shadow-[inset_0_0_0_1px_rgb(201_169_106/0.4)] hover:bg-lol-gold/10 hover:shadow-[inset_0_0_0_1px_rgb(236_217_168/0.8)]`;

export const btnDanger = `${btnBase} bg-red-950/10 text-red-400 shadow-[inset_0_0_0_1px_rgb(239_68_68/0.45)] hover:bg-red-900/30 hover:shadow-[inset_0_0_0_1px_rgb(248_113_113/0.9)]`;

export const panel = 'panel p-6';

export const input =
  'w-full rounded-sm border border-lol-gold/25 bg-[#05080f]/80 px-3 py-2.5 text-lol-text outline-none transition placeholder:text-lol-mist/60 focus:border-lol-gold focus:ring-2 focus:ring-lol-gold/25 disabled:opacity-50';

export const label = 'mb-1.5 block text-sm font-medium text-lol-mist';

export const pageTitle = 'font-display text-4xl font-extrabold leading-none tracking-tight text-gold-gradient sm:text-5xl';

export const sectionTitle = 'flex items-center gap-2.5 font-display text-2xl font-bold tracking-tight text-lol-text';

// Piccolo link-pulsante (azioni secondarie nelle card)
export const linkAction = 'text-sm text-lol-gold transition hover:text-lol-gold-bright';

// Etichetta compatta (stato, ruolo)
export const pill = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium';
