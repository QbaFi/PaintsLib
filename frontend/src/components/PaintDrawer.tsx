import { useQuery } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, TYPE_LABELS, type Paint } from "../api";
import { useReferenceBrandName, useSettings } from "../hooks";
import { OwnershipControls } from "./Ownership";
import { ErrorBox, MatchRow, Swatch } from "./ui";

const DrawerContext = createContext<(paint: Paint) => void>(() => {});

/** Call the returned function with a paint to open its detail panel. */
export function useOpenPaint() {
  return useContext(DrawerContext);
}

export function PaintDrawerProvider({ children }: { children: ReactNode }) {
  const [paintId, setPaintId] = useState<number | null>(null);
  const open = useCallback((p: Paint) => setPaintId(p.id), []);
  return (
    <DrawerContext.Provider value={open}>
      {children}
      {paintId !== null && <PaintDrawer paintId={paintId} onClose={() => setPaintId(null)} />}
    </DrawerContext.Provider>
  );
}

function PaintDrawer({ paintId, onClose }: { paintId: number; onClose: () => void }) {
  const openPaint = useOpenPaint();
  const settings = useSettings().data;
  const refName = useReferenceBrandName();
  const paint = useQuery({ queryKey: ["paint", paintId], queryFn: () => api.paint(paintId) });
  const ref = settings?.reference_brand;
  const isRefBrand = paint.data?.brand.slug === ref;

  const refMatches = useQuery({
    queryKey: ["equivalents", paintId, ref],
    queryFn: () => api.equivalents(paintId, { brand: ref, limit: 3 }),
    enabled: !!ref && paint.isSuccess && !isRefBrand,
  });
  const allMatches = useQuery({
    queryKey: ["equivalents", paintId, "all"],
    queryFn: () => api.equivalents(paintId, {}),
    enabled: paint.isSuccess,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Zamknij" onClick={onClose} />
      <aside className="relative h-full w-full max-w-md overflow-y-auto border-l border-ink-700 bg-ink-900 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md px-2 py-1 text-ink-400 hover:text-ink-200"
          aria-label="Zamknij"
        >
          ✕
        </button>
        {paint.isError && <ErrorBox error={paint.error} />}
        {paint.data && (
          <>
            <div className="flex items-center gap-5">
              <Swatch hex={paint.data.hex} size={96} />
              <div className="min-w-0">
                <h2 className="font-display text-xl text-brass-300">{paint.data.name}</h2>
                <p className="text-sm text-ink-400">
                  {paint.data.brand.name}
                  {paint.data.range_name && ` · ${paint.data.range_name}`}
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  {TYPE_LABELS[paint.data.type]} · <span className="font-mono">{paint.data.hex}</span>
                  {paint.data.code && ` · ${paint.data.code}`}
                  {paint.data.discontinued && " · wycofana"}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <OwnershipControls paint={paint.data} />
            </div>

            {!isRefBrand && (
              <section className="mt-8">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
                  Najbliższe {refName}
                </h3>
                <div className="space-y-3">
                  {refMatches.data?.map((m) => <MatchRow key={m.paint.id} match={m} onOpen={openPaint} />)}
                  {refMatches.data?.length === 0 && <p className="text-sm text-ink-400">Brak dopasowań.</p>}
                </div>
              </section>
            )}

            <section className="mt-8">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-ink-400">
                Najlepszy odpowiednik w każdej marce
              </h3>
              <div className="space-y-3">
                {allMatches.data?.map((m) => <MatchRow key={m.paint.id} match={m} onOpen={openPaint} />)}
              </div>
            </section>

            <p className="mt-8 text-xs leading-relaxed text-ink-400">
              ~ΔE to różnica kolorów (CIEDE2000): poniżej 2 – prawie identyczny, 2–5 – bliski, 5–10 – podobny.
              Kolory w katalogu są przybliżone, więc przed malowaniem większej partii warto porównać farby na żywo.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}
