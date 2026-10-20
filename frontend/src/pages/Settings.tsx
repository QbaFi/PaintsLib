import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { api, type PaintType } from "../api";
import { CsvImport } from "../components/CsvImport";
import { ErrorBox, PageHeader, Swatch, buttonClass, ghostButtonClass, inputClass } from "../components/ui";
import { useBrands, useSettings } from "../hooks";
import { LanguageSwitch, useT } from "../i18n";

export function SettingsPage() {
  const t = useT();
  return (
    <>
      <PageHeader title={t.settings.title} />
      <div className="grid max-w-4xl gap-6">
        <Card title={t.settings.language}>
          <LanguageSwitch />
        </Card>
        <ReferenceBrand />
        <Card title={t.csvImport.title}>
          <CsvImport />
        </Card>
        <CatalogImport />
        <CustomPaint />
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-ink-700 bg-ink-900 p-5">
      <h2 className="mb-4 text-base font-semibold uppercase tracking-widest text-brass-300">{title}</h2>
      {children}
    </section>
  );
}

function ReferenceBrand() {
  const t = useT();
  const qc = useQueryClient();
  const brands = useBrands().data ?? [];
  const settings = useSettings();
  const save = useMutation({
    mutationFn: (slug: string) => api.saveSettings({ reference_brand: slug }),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <Card title={t.settings.referenceTitle}>
      <p className="mb-3 text-sm text-ink-400">{t.settings.referenceHelp}</p>
      <select
        className={inputClass}
        value={settings.data?.reference_brand ?? ""}
        onChange={(e) => save.mutate(e.target.value)}
      >
        {brands.map((b) => (
          <option key={b.slug} value={b.slug}>
            {b.name}
          </option>
        ))}
      </select>
      {save.isSuccess && <span className="ml-3 text-sm text-emerald-300">{t.common.saved}</span>}
      {save.isError && <ErrorBox error={save.error} />}
    </Card>
  );
}

function CatalogImport() {
  const t = useT();
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ["catalog-status"],
    queryFn: api.catalogStatus,
    refetchInterval: (q) => (q.state.data?.running ? 1500 : false),
  });
  const start = useMutation({
    mutationFn: api.startImport,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog-status"] }),
  });
  const s = status.data;
  return (
    <Card title={t.settings.catalogTitle}>
      {s && (
        <p className="mb-3 text-sm text-ink-400">{t.settings.catalogCounts(s.paint_count, s.brand_count, s.inventory_count)}</p>
      )}
      <p className="mb-4 text-sm text-ink-400">
        {t.settings.catalogSourceBefore}{" "}
        <a
          className="text-brass-300 hover:underline"
          href="https://github.com/Arcturus5404/miniature-paints"
          target="_blank"
          rel="noreferrer"
        >
          miniature-paints
        </a>{" "}
        {t.settings.catalogSourceAfter}
      </p>
      <button
        type="button"
        className={ghostButtonClass}
        disabled={s?.running || start.isPending}
        onClick={() => start.mutate()}
      >
        {s?.running ? t.settings.importing : t.settings.importButton}
      </button>
      {s?.error && <p className="mt-3 text-sm text-red-300">{t.settings.importFailed(s.error)}</p>}
      {s?.result && !s.running && (
        <p className="mt-3 text-sm text-emerald-300">{t.settings.importDone(s.result.created, s.result.updated)}</p>
      )}
    </Card>
  );
}

function CustomPaint() {
  const t = useT();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    brand_name: "",
    name: "",
    range_name: "",
    hex: "#7A5C3E",
    type: "base" as PaintType,
  });
  const create = useMutation({
    mutationFn: () => api.createPaint(form),
    onSuccess: async (paint) => {
      await api.addToInventory({ paint_id: paint.id });
      qc.invalidateQueries();
      setForm({ ...form, name: "", range_name: "" });
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };
  return (
    <Card title={t.settings.customTitle}>
      <p className="mb-4 text-sm text-ink-400">{t.settings.customHelp}</p>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <input
          required
          className={inputClass}
          placeholder={t.settings.customBrand}
          value={form.brand_name}
          onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
        />
        <input
          required
          className={inputClass}
          placeholder={t.settings.customName}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder={t.settings.customRange}
          value={form.range_name}
          onChange={(e) => setForm({ ...form, range_name: e.target.value })}
        />
        <select
          className={inputClass}
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as PaintType })}
        >
          {(Object.keys(t.types) as PaintType[]).map((pt) => (
            <option key={pt} value={pt}>
              {t.types[pt]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-3 text-sm text-ink-400">
          <span className="relative">
            <Swatch hex={form.hex} size={40} />
            <input
              type="color"
              value={form.hex}
              onChange={(e) => setForm({ ...form, hex: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </span>
          {t.settings.customColor} <span className="font-mono">{form.hex.toUpperCase()}</span>
        </label>
        <div className="flex items-center">
          <button type="submit" className={buttonClass} disabled={create.isPending}>
            {t.settings.customSubmit}
          </button>
        </div>
      </form>
      {create.isError && (
        <div className="mt-3">
          <ErrorBox error={create.error} />
        </div>
      )}
      {create.isSuccess && <p className="mt-3 text-sm text-emerald-300">{t.settings.customAdded}</p>}
    </Card>
  );
}
