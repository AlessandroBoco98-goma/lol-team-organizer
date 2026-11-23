import { ROLES, ROLE_COLORS, ROLE_LABELS, type Role } from "../types";

// "Con che ruolo giochi?": i ruoli già scelti da altri sono disattivati e mostrano chi li ha
export default function RolePicker({
  taken,
  current,
  disabled,
  onPick,
  onCancel,
}: {
  taken: Partial<Record<Role, string>>;
  current?: Role;
  disabled?: boolean;
  onPick: (role: Role) => void;
  onCancel?: () => void;
}) {
  const free = ROLES.filter((r) => !taken[r]).length;
  return (
    <div className="animate-fade-in space-y-3 border-t border-lol-gold/15 pt-4" role="group" aria-label="Scegli il ruolo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Con che ruolo giochi?</p>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-xs text-lol-mist transition hover:text-lol-text">
            Annulla
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {ROLES.map((role) => {
          const owner = taken[role];
          const active = current === role;
          const color = ROLE_COLORS[role];
          return (
            <button
              key={role}
              type="button"
              disabled={disabled || !!owner}
              onClick={() => onPick(role)}
              aria-pressed={active}
              title={owner ? `${ROLE_LABELS[role]}: scelto da ${owner}` : `Gioco ${ROLE_LABELS[role]}`}
              className="chamfer flex min-w-[5.5rem] flex-col items-start px-3 py-2 text-left transition duration-200 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-35 [--c:8px]"
              style={{
                color: active ? "#060a12" : color,
                backgroundColor: active ? color : `${color}14`,
                boxShadow: `inset 0 0 0 1px ${color}${active ? "" : "80"}`,
              }}
            >
              <span className="text-sm font-semibold">{ROLE_LABELS[role]}</span>
              <span className={`text-[11px] ${active ? "opacity-80" : "text-lol-mist"}`}>{owner ? owner : "libero"}</span>
            </button>
          );
        })}
      </div>
      {free === 0 && <p className="text-xs text-lol-mist">Tutti i ruoli sono già stati scelti.</p>}
    </div>
  );
}
