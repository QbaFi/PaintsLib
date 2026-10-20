import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api";
import { useOpenPaint } from "../components/PaintDrawer";
import { Empty, ErrorBox, MatchRow, PageHeader, Swatch, inputClass, useDebounced } from "../components/ui";
import { useBrands } from "../hooks";
import { useT } from "../i18n";

export function ColorSearchPage() {
  const t = useT();
  const GROUPS = [
    { value: "", label: t.color.groupAny },
    { value: "opaque", label: t.color.groupOpaque },
    { value: "contrast", label: t.color.groupContrast },
    { value: "shade", label: t.color.groupShade },
    { value: "technical", label: t.color.groupTechnical },
  ];
  const [hex, setHex] = useState("#9A1115");
  const [text, setText] = useState("#9A1115");
  const [group, setGroup] = useState("");
  const [brand, setBrand] = useState("");
  const [ownedFirst, setOwnedFirst] = useState(true);
  const colour = useDebounced(hex, 150);
  const brands = useBrands().data ?? [];
  const openPaint = useOpenPaint();

  const results = useQuery({
    queryKey: ["match", colour, group, brand, ownedFirst],
    queryFn: () =>
      api.match({ hex: colour.replace("#", ""), type: group, brand, limit: brand ? 12 : 5, owned_first: ownedFirst }),
  });

  const onText = (value: string) => {
    setText(value);
    const v = value.trim().startsWith("#") ? value.trim() : `#${value.trim()}`;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) setHex(v.toUpperCase());
  };

  return (
    <>
      <PageHeader title={t.color.title} subtitle={t.color.subtitle} />

      <div className="mb-8 flex flex-wrap items-center gap-4 rounded-xl border border-ink-700 bg-ink-900 p-4">
        <label className="relative cursor-pointer" title={t.color.pick}>
          <Swatch hex={hex} size={72} />
          <input
            type="color"
            value={hex}
            onChange={(e) => {
              setHex(e.target.value.toUpperCase());
              setText(e.target.value.toUpperCase());
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <input
          className={`${inputClass} w-32 font-mono`}
          value={text}
          onChange={(e) => onText(e.target.value)}
          aria-label={t.color.hex}
        />
        <select className={inputClass} value={group} onChange={(e) => setGroup(e.target.value)}>
          {GROUPS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        <select className={inputClass} value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">{t.color.bestPerBrand}</option>
          {brands.map((b) => (
            <option key={b.slug} value={b.slug}>
              {t.color.onlyBrand(b.name)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-400">
          <input type="checkbox" checked={ownedFirst} onChange={(e) => setOwnedFirst(e.target.checked)} />
          {t.color.ownedFirst}
        </label>
      </div>

      {results.isError && <ErrorBox error={results.error} />}
      {results.data?.length === 0 && <Empty>{t.color.noResults}</Empty>}
      <div className="max-w-2xl space-y-4">
        {results.data?.map((m) => <MatchRow key={m.paint.id} match={m} onOpen={openPaint} />)}
      </div>
    </>
  );
}
