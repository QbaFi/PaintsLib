import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { api, type PaintType } from "../api";
import { useT } from "../i18n";
import { OwnershipControls } from "../components/Ownership";
import { useOpenPaint } from "../components/PaintDrawer";
import { Empty, ErrorBox, PageHeader, PaintLabel, Swatch, ghostButtonClass, inputClass, useDebounced } from "../components/ui";
import { useBrands } from "../hooks";

const PAGE_SIZE = 48;

export function CatalogPage() {
  const t = useT();
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
        title={t.catalog.title}
        subtitle={paints.data ? t.catalog.results(paints.data.total) : t.catalog.hint}
      />

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input
          autoFocus
          className={`${inputClass} col-span-2`}
          placeholder={t.catalog.placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t.common.anyType}</option>
          {(Object.keys(t.types) as PaintType[]).map((pt) => (
            <option key={pt} value={pt}>
              {t.types[pt]}
            </option>
          ))}
        </select>
        <select className={inputClass} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="relevance">{t.catalog.sortRelevance}</option>
          <option value="name">{t.collection.sortName}</option>
          <option value="hue">{t.collection.sortHue}</option>
          <option value="brand">{t.collection.sortBrand}</option>
        </select>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Chip active={brand === ""} onClick={() => setBrand("")}>
          {t.catalog.all}
        </Chip>
        {brands.data?.map((b) => (
          <Chip key={b.slug} active={brand === b.slug} onClick={() => setBrand(b.slug)}>
            {b.name} <span className="text-ink-400">{b.paint_count}</span>
          </Chip>
        ))}
        <span className="mx-1 h-5 w-px bg-ink-700" />
        <select className={`${inputClass} py-1`} value={owned} onChange={(e) => setOwned(e.target.value)}>
          <option value="">{t.catalog.ownedAny}</option>
          <option value="true">{t.catalog.ownedOnly}</option>
          <option value="false">{t.catalog.ownedNot}</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-400">
          <input type="checkbox" checked={discontinued} onChange={(e) => setDiscontinued(e.target.checked)} />
          {t.catalog.showDiscontinued}
        </label>
      </div>

      {catalogEmpty && (
        <Empty>{t.catalog.empty}</Empty>
      )}
      {paints.isError && <ErrorBox error={paints.error} />}
      {paints.data?.items.length === 0 && !catalogEmpty && <Empty>{t.catalog.noResults}</Empty>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {paints.data?.items.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-3 rounded-xl border bg-ink-900 p-3 ${
              p.owned ? "border-brass-600/60" : "border-ink-700"
            }`}
          >
            <button type="button" onClick={() => openPaint(p)} aria-label={t.catalog.details(p.name)}>
              <Swatch hex={p.hex} size={48} />
            </button>
            <div className="min-w-0 flex-1">
              <PaintLabel paint={p} onClick={() => openPaint(p)} />
              <span className="text-[11px] text-ink-400">{t.types[p.type]}</span>
            </div>
            <OwnershipControls paint={p} compact />
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button type="button" className={ghostButtonClass} disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t.catalog.prev}
          </button>
          <span className="text-sm text-ink-400">
            {page} / {pages}
          </span>
          <button type="button" className={ghostButtonClass} disabled={page >= pages} onClick={() => setPage(page + 1)}>
            {t.catalog.next}
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
