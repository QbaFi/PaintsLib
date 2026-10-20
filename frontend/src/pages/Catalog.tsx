import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { api, TYPE_LABELS, type PaintType } from "../api";
import { OwnershipControls } from "../components/Ownership";
import { useOpenPaint } from "../components/PaintDrawer";
import { Empty, ErrorBox, PageHeader, PaintLabel, Swatch, ghostButtonClass, inputClass, useDebounced } from "../components/ui";
import { useBrands } from "../hooks";

const PAGE_SIZE = 48;

export function CatalogPage() {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [type, setType] = useState("");
  const [owned, setOwned] = useState("");
  const [discontinued, setDiscontinued] = useState(false);
  const [sort, setSort] = useState("relevance");
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const brands = useBrands();
  const openPaint = useOpenPaint();

  useEffect(() => setPage(1), [search, brand, type, owned, discontinued, sort]);

  const paints = useQuery({
    queryKey: ["paints", search, brand, type, owned, discontinued, sort, page],
    queryFn: () =>
      api.paints({
        q: search,
        brand,
        type,
        owned: owned || undefined,
        include_discontinued: discontinued,
        sort,
        page,
        page_size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });

  const pages = paints.data ? Math.max(1, Math.ceil(paints.data.total / PAGE_SIZE)) : 1;
  const catalogEmpty = brands.data?.length === 0;

  return (
    <>
      <PageHeader
        title="Katalog farb"
        subtitle={paints.data ? `${paints.data.total} wyników` : "Wyszukaj farbę po nazwie, marce lub linii"}
      />

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input
          autoFocus
          className={`${inputClass} col-span-2`}
          placeholder="np. Mephiston, Leadbelcher, 72.010…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Każdy typ</option>
          {(Object.keys(TYPE_LABELS) as PaintType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select className={inputClass} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="relevance">Sortuj: trafność</option>
          <option value="name">Sortuj: nazwa</option>
          <option value="hue">Sortuj: kolor</option>
          <option value="brand">Sortuj: marka</option>
        </select>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Chip active={brand === ""} onClick={() => setBrand("")}>
          Wszystkie
        </Chip>
        {brands.data?.map((b) => (
          <Chip key={b.slug} active={brand === b.slug} onClick={() => setBrand(b.slug)}>
            {b.name} <span className="text-ink-400">{b.paint_count}</span>
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px bg-ink-700" />
        <select className={`${inputClass} py-1`} value={owned} onChange={(e) => setOwned(e.target.value)}>
          <option value="">Posiadane i nie</option>
          <option value="true">Tylko moje</option>
          <option value="false">Których nie mam</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-400">
          <input type="checkbox" checked={discontinued} onChange={(e) => setDiscontinued(e.target.checked)} />
          pokaż wycofane
        </label>
      </div>

      {catalogEmpty && (
        <Empty>
          Katalog jest pusty — import farb trwa zwykle kilkanaście sekund po pierwszym uruchomieniu. Odśwież stronę za
          chwilę albo sprawdź zakładkę Ustawienia.
        </Empty>
      )}
      {paints.isError && <ErrorBox error={paints.error} />}
      {paints.data?.items.length === 0 && !catalogEmpty && <Empty>Nic nie znaleziono. Spróbuj krótszej nazwy.</Empty>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {paints.data?.items.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-3 rounded-xl border bg-ink-900 p-3 ${
              p.owned ? "border-brass-600/60" : "border-ink-700"
            }`}
          >
            <button type="button" onClick={() => openPaint(p)} aria-label={`Szczegóły: ${p.name}`}>
              <Swatch hex={p.hex} size={48} />
            </button>
            <div className="min-w-0 flex-1">
              <PaintLabel paint={p} onClick={() => openPaint(p)} />
              <span className="text-[11px] text-ink-400">{TYPE_LABELS[p.type]}</span>
            </div>
            <OwnershipControls paint={p} compact />
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" className={ghostButtonClass} disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ← Poprzednia
          </button>
          <span className="text-sm text-ink-400">
            {page} / {pages}
          </span>
          <button type="button" className={ghostButtonClass} disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Następna →
          </button>
        </div>
      )}
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm ${
        active ? "border-brass-500 bg-brass-500/15 text-brass-300" : "border-ink-600 text-ink-200 hover:border-ink-400"
      }`}
    >
      {children}
    </button>
  );
}
