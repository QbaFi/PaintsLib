import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type PaintType, type Status } from "../api";
import { useT } from "../i18n";
import { QuantityStepper } from "../components/Ownership";
import { useOpenPaint } from "../components/PaintDrawer";
import {
  Empty,
  ErrorBox,
  PageHeader,
  PaintLabel,
  QualityBadge,
  StatusSelect,
  Swatch,
  inputClass,
  useDebounced,
} from "../components/ui";
import { useBrands, useReferenceBrandName, useRemoveFromInventory, useUpdateInventory } from "../hooks";

type Sort = "brand" | "name" | "hue" | "recent";

export function CollectionPage() {
  const t = useT();
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("full,low,empty");
  const [sort, setSort] = useState<Sort>("brand");
  const search = useDebounced(q);

  const brands = useBrands().data ?? [];
  const refName = useReferenceBrandName();
  const openPaint = useOpenPaint();
  const update = useUpdateInventory();
  const remove = useRemoveFromInventory();

  const items = useQuery({
    queryKey: ["inventory", search, brand, type, status, sort],
    queryFn: () => api.inventory({ q: search, brand, type, status, sort }),
  });

  return (
    <>
      <PageHeader
        title={t.collection.title}
        subtitle={items.data ? t.collection.subtitle(items.data.length, refName) : undefined}
      >
        <Link to="/catalog" className="text-sm text-brass-300 hover:underline">
          {t.collection.addFromCatalog}
        </Link>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <input
          className={`${inputClass} col-span-2 sm:col-span-1`}
          placeholder={t.common.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className={inputClass} value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">{t.common.allBrands}</option>
          {brands.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
        <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t.common.anyType}</option>
          {(Object.keys(t.types) as PaintType[]).map((pt) => (
            <option key={pt} value={pt}>
              {t.types[pt]}
            </option>
          ))}
        </select>
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="full,low,empty">{t.collection.statusOwned}</option>
          {(Object.keys(t.statuses) as Status[]).map((s) => (
            <option key={s} value={s}>
              {t.statuses[s]}
            </option>
          ))}
          <option value="">{t.collection.statusAll}</option>
        </select>
        <select className={inputClass} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="brand">{t.collection.sortBrand}</option>
          <option value="name">{t.collection.sortName}</option>
          <option value="hue">{t.collection.sortHue}</option>
          <option value="recent">{t.collection.sortRecent}</option>
        </select>
      </div>

      {items.isError && <ErrorBox error={items.error} />}
      {items.isLoading && <p className="text-ink-400">{t.common.loading}</p>}
      {items.data?.length === 0 && (
        <Empty>
          {t.collection.emptyBefore}{" "}
          <Link className="text-brass-300 hover:underline" to="/catalog">
            {t.collection.emptyLink}
          </Link>{" "}
          {t.collection.emptyAfter}
        </Empty>
      )}

      {!!items.data?.length && (
        <div className="overflow-hidden rounded-xl border border-ink-700">
          <div className="hidden grid-cols-[minmax(0,2fr)_auto_auto_minmax(0,2fr)_auto] gap-4 border-b border-ink-700 bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-ink-400 md:grid">
            <span>{t.collection.colPaint}</span>
            <span>{t.collection.colQty}</span>
            <span>{t.collection.colStatus}</span>
            <span>{refName} ≈</span>
            <span />
          </div>
          <ul className="divide-y divide-ink-700">
            {items.data.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-3 hover:bg-ink-900/60 md:grid-cols-[minmax(0,2fr)_auto_auto_minmax(0,2fr)_auto]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Swatch hex={item.paint.hex} />
                  <PaintLabel paint={item.paint} onClick={() => openPaint(item.paint)} />
                </div>
                <div className="justify-self-end md:justify-self-start">
                  {item.status === "wishlist" ? (
                    <span className="text-xs text-sky-300">{t.collection.toBuy}</span>
                  ) : (
                    <QuantityStepper
                      value={item.quantity}
                      onChange={(quantity) => update.mutate({ id: item.id, quantity })}
                    />
                  )}
                </div>
                <div>
                  <StatusSelect value={item.status} onChange={(s) => update.mutate({ id: item.id, status: s })} />
                </div>
                <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                  {item.reference_match ? (
                    <>
                      <Swatch hex={item.reference_match.paint.hex} size={28} />
                      <div className="min-w-0 flex-1">
                        <PaintLabel
                          paint={item.reference_match.paint}
                          onClick={() => item.reference_match && openPaint(item.reference_match.paint)}
                        />
                      </div>
                      <QualityBadge match={item.reference_match} />
                    </>
                  ) : (
                    <span className="text-xs text-ink-400">{t.collection.alreadyRef(refName)}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="justify-self-end rounded-md px-2 py-1 text-ink-400 hover:text-red-300"
                  title={t.common.remove}
                  onClick={() => remove.mutate(item.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
