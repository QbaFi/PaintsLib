import { useEffect, useState, type ReactNode } from "react";
import { QUALITY_LABELS, STATUS_LABELS, type Match, type Paint, type Status } from "../api";

/** A paint "pot" colour sample. Light colours get a darker outline so they stay visible. */
export function Swatch({ hex, size = 40, className = "" }: { hex: string; size?: number; className?: string }) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full ring-1 ring-inset ring-white/15 shadow-[inset_0_-6px_10px_rgba(0,0,0,0.35)] ${className}`}
      style={{ background: hex, width: size, height: size }}
      title={hex}
    />
  );
}

export function PaintLabel({ paint, onClick }: { paint: Paint; onClick?: () => void }) {
  const inner = (
    <>
      <span className="block truncate font-medium text-ink-200">{paint.name}</span>
      <span className="block truncate text-xs text-ink-400">
        {paint.brand.name}
        {paint.range_name ? ` · ${paint.range_name}` : ""}
        {paint.code ? ` · ${paint.code}` : ""}
        {paint.discontinued ? " · wycofana" : ""}
      </span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="min-w-0 text-left hover:[&>span:first-child]:text-brass-300">
      {inner}
    </button>
  ) : (
    <div className="min-w-0">{inner}</div>
  );
}

const QUALITY_STYLES: Record<Match["quality"], string> = {
  curated: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  near_identical: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  close: "bg-lime-500/10 text-lime-300 ring-lime-400/25",
  similar: "bg-amber-500/10 text-amber-300 ring-amber-400/25",
  distant: "bg-red-500/10 text-red-300 ring-red-400/25",
};

/** ΔE badge. The "~" reminds that catalog colours are approximations. */
export function QualityBadge({ match }: { match: Match }) {
  const title =
    match.quality === "curated"
      ? "Odpowiednik potwierdzony ręcznie"
      : `ΔE₀₀ = ${match.delta_e} (${QUALITY_LABELS[match.quality]}). Kolory w katalogu są przybliżone.`;
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${QUALITY_STYLES[match.quality]}`}
    >
      {match.quality === "curated" ? "✓ potwierdzony" : `~ΔE ${match.delta_e?.toFixed(1)}`}
    </span>
  );
}

export function MatchRow({ match, onOpen }: { match: Match; onOpen?: (p: Paint) => void }) {
  return (
    <div className="flex items-center gap-3">
      <Swatch hex={match.paint.hex} size={28} />
      <div className="min-w-0 flex-1">
        <PaintLabel paint={match.paint} onClick={onOpen ? () => onOpen(match.paint) : undefined} />
      </div>
      {match.paint.owned && <span className="text-[11px] text-brass-300" title="Masz tę farbę">● mam</span>}
      <QualityBadge match={match} />
    </div>
  );
}

const STATUS_STYLES: Record<Status, string> = {
  full: "text-emerald-300",
  low: "text-amber-300",
  empty: "text-red-300",
  wishlist: "text-sky-300",
};

export function StatusSelect({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Status)}
      className={`rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-sm ${STATUS_STYLES[value]}`}
    >
      {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl tracking-wide text-brass-300 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export const inputClass =
  "rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-ink-200 placeholder:text-ink-400 focus:border-brass-500 focus:outline-none";
export const buttonClass =
  "inline-flex items-center justify-center gap-1 rounded-md bg-brass-500 px-3 py-2 text-sm font-semibold text-ink-950 hover:bg-brass-400 disabled:opacity-50";
export const ghostButtonClass =
  "inline-flex items-center justify-center gap-1 rounded-md border border-ink-600 px-3 py-2 text-sm text-ink-200 hover:border-brass-500 hover:text-brass-300 disabled:opacity-50";

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-ink-600 p-10 text-center text-ink-400">{children}</div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
      Coś poszło nie tak: {error instanceof Error ? error.message : String(error)}
    </div>
  );
}

export function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
