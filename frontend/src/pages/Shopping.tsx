import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, STATUS_LABELS } from "../api";
import { OwnershipControls } from "../components/Ownership";
import { useOpenPaint } from "../components/PaintDrawer";
import { Empty, ErrorBox, PageHeader, PaintLabel, Swatch, ghostButtonClass } from "../components/ui";

const SHOPPING_STATUSES = "wishlist,empty,low";

export function ShoppingPage() {
  const openPaint = useOpenPaint();
  const [copied, setCopied] = useState(false);
  const items = useQuery({
    queryKey: ["inventory", "shopping"],
    queryFn: () => api.inventory({ status: SHOPPING_STATUSES, sort: "brand", ref: "none" }),
  });

  const copy = async () => {
    const text = (items.data ?? [])
      .map((i) => `- ${i.paint.brand.name} ${i.paint.name}${i.paint.range_name ? ` (${i.paint.range_name})` : ""}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <PageHeader title="Lista zakupów" subtitle="Farby oznaczone jako „do kupienia”, puste lub kończące się">
        {!!items.data?.length && (
          <div className="flex gap-2">
            <button type="button" className={ghostButtonClass} onClick={copy}>
              {copied ? "Skopiowano ✓" : "Kopiuj jako tekst"}
            </button>
            <a className={ghostButtonClass} href={`/api/inventory/export.csv?status=${SHOPPING_STATUSES}`}>
              Pobierz CSV
            </a>
          </div>
        )}
      </PageHeader>

      {items.isError && <ErrorBox error={items.error} />}
      {items.data?.length === 0 && (
        <Empty>Lista jest pusta. W katalogu kliknij „☆”, żeby dodać farbę do kupienia.</Empty>
      )}
      <ul className="space-y-2">
        {items.data?.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 p-3">
            <Swatch hex={item.paint.hex} />
            <div className="min-w-0 flex-1">
              <PaintLabel paint={item.paint} onClick={() => openPaint(item.paint)} />
              <span className="text-[11px] text-ink-400">{STATUS_LABELS[item.status]}</span>
            </div>
            <OwnershipControls paint={item.paint} />
          </li>
        ))}
      </ul>
    </>
  );
}
