import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactNode } from "react";
import { api, TYPE_LABELS, type PaintType } from "../api";
import { ErrorBox, PageHeader, Swatch, buttonClass, ghostButtonClass, inputClass } from "../components/ui";
import { useBrands, useSettings } from "../hooks";

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Ustawienia" />
      <div className="grid max-w-3xl gap-6">
        <ReferenceBrand />
        <CatalogImport />
        <CustomPaint />
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-ink-700 bg-ink-900 p-5">
      <h2 className="mb-4 font-display text-lg text-brass-300">{title}</h2>
      {children}
    </section>
  );
}

function ReferenceBrand() {
  const qc = useQueryClient();
  const brands = useBrands().data ?? [];
  const settings = useSettings();
  const save = useMutation({
    mutationFn: (slug: string) => api.saveSettings({ reference_brand: slug }),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <Card title="Marka referencyjna">
      <p className="mb-3 text-sm text-ink-400">
        Przy każdej farbie w kolekcji pokazuję najbliższy odpowiednik z tej marki.
      </p>
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
      {save.isSuccess && <span className="ml-3 text-sm text-emerald-300">Zapisano ✓</span>}
      {save.isError && <ErrorBox error={save.error} />}
    </Card>
  );
}

function CatalogImport() {
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
    <Card title="Katalog farb">
      {s && (
        <p className="mb-3 text-sm text-ink-400">
          W bazie: <b className="text-ink-200">{s.paint_count}</b> farb z <b className="text-ink-200">{s.brand_count}</b>{" "}
          marek. W kolekcji: <b className="text-ink-200">{s.inventory_count}</b>.
        </p>
      )}
      <p className="mb-4 text-sm text-ink-400">
        Dane pochodzą z otwartego zbioru{" "}
        <a className="text-brass-300 hover:underline" href="https://github.com/Arcturus5404/miniature-paints" target="_blank" rel="noreferrer">
          miniature-paints
        </a>{" "}
        (licencja MIT). Aktualizacja nie usuwa Twojej kolekcji ani ręcznie poprawionych kolorów.
      </p>
      <button type="button" className={ghostButtonClass} disabled={s?.running || start.isPending} onClick={() => start.mutate()}>
        {s?.running ? "Importuję…" : "Importuj / aktualizuj katalog"}
      </button>
      {s?.error && <p className="mt-3 text-sm text-red-300">Ostatni import się nie udał: {s.error}</p>}
      {s?.result && !s.running && (
        <p className="mt-3 text-sm text-emerald-300">
          Ostatni import: {s.result.created} nowych, {s.result.updated} zaktualizowanych.
        </p>
      )}
    </Card>
  );
}

function CustomPaint() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ brand_name: "", name: "", range_name: "", hex: "#7A5C3E", type: "base" as PaintType });
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
    <Card title="Dodaj własną farbę">
      <p className="mb-4 text-sm text-ink-400">
        Farba spoza katalogu (np. inna marka). Zostanie od razu dodana do Twojej kolekcji.
      </p>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <input required className={inputClass} placeholder="Marka (np. Two Thin Coats)" value={form.brand_name}
          onChange={(e) => setForm({ ...form, brand_name: e.target.value })} />
        <input required className={inputClass} placeholder="Nazwa farby" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={inputClass} placeholder="Linia (opcjonalnie)" value={form.range_name}
          onChange={(e) => setForm({ ...form, range_name: e.target.value })} />
        <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PaintType })}>
          {(Object.keys(TYPE_LABELS) as PaintType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <label className="flex items-center gap-3 text-sm text-ink-400">
          <span className="relative">
            <Swatch hex={form.hex} size={40} />
            <input type="color" value={form.hex} onChange={(e) => setForm({ ...form, hex: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0" />
          </span>
          Kolor <span className="font-mono">{form.hex.toUpperCase()}</span>
        </label>
        <div className="flex items-center">
          <button type="submit" className={buttonClass} disabled={create.isPending}>Dodaj do kolekcji</button>
        </div>
      </form>
      {create.isError && <div className="mt-3"><ErrorBox error={create.error} /></div>}
      {create.isSuccess && <p className="mt-3 text-sm text-emerald-300">Dodano ✓</p>}
    </Card>
  );
}
