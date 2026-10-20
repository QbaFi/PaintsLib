import type { Paint } from "../api";
import { useT } from "../i18n";
import { useAddToInventory, useRemoveFromInventory, useUpdateInventory } from "../hooks";
import { StatusSelect, buttonClass, ghostButtonClass } from "./ui";

/** Add/remove a paint from the collection, or adjust quantity and status in place. */
export function OwnershipControls({ paint, compact = false }: { paint: Paint; compact?: boolean }) {
  const t = useT();
  const add = useAddToInventory();
  const update = useUpdateInventory();
  const remove = useRemoveFromInventory();
  const busy = add.isPending || update.isPending || remove.isPending;

  if (paint.inventory_id === null) {
    return (
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={busy} onClick={() => add.mutate({ paint_id: paint.id })}>
          {t.ownership.have}
        </button>
        <button
          type="button"
          className={ghostButtonClass}
          disabled={busy}
          title={t.ownership.wishlistTitle}
          onClick={() => add.mutate({ paint_id: paint.id, status: "wishlist" })}
        >
          {compact ? "☆" : t.ownership.wishlist}
        </button>
      </div>
    );
  }

  const id = paint.inventory_id;
  const qty = paint.inventory_quantity ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {paint.inventory_status === "wishlist" ? (
        <button
          type="button"
          className={buttonClass}
          disabled={busy}
          onClick={() => update.mutate({ id, status: "full", quantity: Math.max(qty, 1) })}
        >
          {t.ownership.bought}
        </button>
      ) : (
        <QuantityStepper value={qty} disabled={busy} onChange={(quantity) => update.mutate({ id, quantity })} />
      )}
      {!compact && paint.inventory_status && (
        <StatusSelect value={paint.inventory_status} onChange={(status) => update.mutate({ id, status })} />
      )}
      <button
        type="button"
        className="rounded-md px-2 py-1 text-sm text-ink-400 hover:text-red-300"
        disabled={busy}
        title={t.common.remove}
        onClick={() => remove.mutate(id)}
      >
        ✕
      </button>
    </div>
  );
}

export function QuantityStepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <div className="inline-flex items-center rounded-md border border-ink-600 bg-ink-800">
      <button
        type="button"
        className="px-2 py-1 text-ink-400 hover:text-brass-300 disabled:opacity-40"
        disabled={disabled || value <= 0}
        onClick={() => onChange(value - 1)}
        aria-label={t.common.less}
      >
        −
      </button>
      <span className="min-w-[2ch] text-center text-sm tabular-nums">{value}</span>
      <button
        type="button"
        className="px-2 py-1 text-ink-400 hover:text-brass-300 disabled:opacity-40"
        disabled={disabled}
        onClick={() => onChange(value + 1)}
        aria-label={t.common.more}
      >
        +
      </button>
    </div>
  );
}
