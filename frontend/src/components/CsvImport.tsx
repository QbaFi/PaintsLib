import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ChangeEvent } from "react";
import { api, type ImportMatch, type ImportReport, type ImportRow } from "../api";
import { useT } from "../i18n";
import { useOpenPaint } from "./PaintDrawer";
import { ErrorBox, Swatch, buttonClass, ghostButtonClass } from "./ui";

const MATCH_STYLES: Record<ImportMatch, string> = {
  exact: "text-emerald-300",
  fuzzy: "text-amber-300",
  not_found: "text-red-300",
  unknown_brand: "text-red-300",
  invalid: "text-red-300",
};

/** Upload a collection CSV: preview first (dry run), then confirm to save. */
export function CsvImport() {
  const t = useT();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [problemsOnly, setProblemsOnly] = useState(false);

  const run = useMutation({
    mutationFn: (vars: { csv: string; dryRun: boolean }) => api.importCollection(vars.csv, vars.dryRun),
    onSuccess: (data) => {
      setReport(data);
      if (!data.dry_run) qc.invalidateQueries();
    },
  });

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    setReport(null);
    run.mutate({ csv: text, dryRun: true });
    e.target.value = ""; // allow picking the same file again
  };

  const reset = () => {
    setCsv(null);
    setReport(null);
    setFileName("");
  };

  const importable = report ? report.summary.added + report.summary.updated : 0;
  const rows = report?.rows.filter((r) => !problemsOnly || isProblem(r)) ?? [];

  return (
    <div>
      <p className="mb-4 text-sm leading-relaxed text-ink-400">{t.csvImport.help}</p>
      <div className="flex flex-wrap items-center gap-2">
        <a className={ghostButtonClass} href="/api/inventory/template.csv">
          {t.csvImport.template}
        </a>
        <button type="button" className={buttonClass} onClick={() => fileInput.current?.click()} disabled={run.isPending}>
          {t.csvImport.choose}
        </button>
        <input ref={fileInput} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        {fileName && <span className="text-sm text-ink-400">{fileName}</span>}
      </div>

      {run.isPending && <p className="mt-4 text-sm text-ink-400">{run.variables?.dryRun ? t.csvImport.previewing : t.csvImport.importing}</p>}
      {run.isError && (
        <div className="mt-4">
          <ErrorBox error={run.error} />
        </div>
      )}

      {report && !run.isPending && (
        <div className="mt-5">
          <div
            className={`rounded-lg border p-3 text-sm ${
              report.dry_run ? "border-ink-600 bg-ink-800" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {!report.dry_run && <b className="mr-2">{t.csvImport.done}</b>}
            {t.csvImport.summary(report.summary)}
            {report.dry_run && <div className="mt-1 text-ink-400">{t.csvImport.previewNote}</div>}
            {report.summary.unknown_columns.length > 0 && (
              <div className="mt-1 text-amber-300">
                {t.csvImport.unknownColumns(report.summary.unknown_columns.join(", "))}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {report.dry_run && csv && (
              <button
                type="button"
                className={buttonClass}
                disabled={importable === 0 && report.summary.equivalents_added === 0}
                onClick={() => run.mutate({ csv, dryRun: false })}
              >
                {t.csvImport.confirm(importable)}
              </button>
            )}
            {!report.dry_run && (
              <button type="button" className={ghostButtonClass} onClick={reset}>
                {t.csvImport.again}
              </button>
            )}
            <label className="flex items-center gap-2 text-sm text-ink-400">
              <input type="checkbox" checked={problemsOnly} onChange={(e) => setProblemsOnly(e.target.checked)} />
              {t.csvImport.filterProblems}
            </label>
          </div>

          <div className="mt-4 max-h-[28rem] overflow-auto rounded-lg border border-ink-700">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-ink-900 text-xs uppercase tracking-widest text-ink-400">
                <tr>
                  <th className="px-3 py-2">{t.csvImport.colLine}</th>
                  <th className="px-3 py-2">{t.csvImport.colInput}</th>
                  <th className="px-3 py-2">{t.csvImport.colMatch}</th>
                  <th className="px-3 py-2">{t.csvImport.colConversion}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {rows.map((row) => (
                  <ReportRow key={row.line} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function isProblem(row: ImportRow): boolean {
  return row.match !== "exact" || row.conversions.some((c) => c.match !== "exact");
}

function ReportRow({ row }: { row: ImportRow }) {
  const t = useT();
  const openPaint = useOpenPaint();
  return (
    <tr className="align-top">
      <td className="px-3 py-2 tabular-nums text-ink-400">{row.line}</td>
      <td className="px-3 py-2">
        <div className="text-ink-200">{row.name || "—"}</div>
        <div className="text-xs text-ink-400">
          {row.brand}
          {row.series && ` · ${row.series}`}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className={`text-xs font-semibold ${MATCH_STYLES[row.match]}`}>
          {t.csvImport.match[row.match]}
          {row.action !== "skipped" && <span className="font-normal text-ink-400"> · {t.csvImport.action[row.action]}</span>}
        </div>
        {row.paint && (
          <button type="button" className="mt-1 flex items-center gap-2 text-left" onClick={() => row.paint && openPaint(row.paint)}>
            <Swatch hex={row.paint.hex} size={18} />
            <span>
              {row.paint.name} <span className="text-xs text-ink-400">({row.paint.range_name || row.paint.brand.name})</span>
            </span>
          </button>
        )}
        {row.suggestion && <div className="mt-1 text-xs text-ink-400">{t.csvImport.suggestion(row.suggestion.name)}</div>}
        {row.error && <div className="mt-1 text-xs text-red-300">{row.error}</div>}
      </td>
      <td className="px-3 py-2">
        {row.conversions.map((c) => (
          <div key={c.name} className="flex items-center gap-2 py-0.5">
            {c.paint ? (
              <>
                <Swatch hex={c.paint.hex} size={14} />
                <span className={c.match === "fuzzy" ? "text-amber-300" : ""}>
                  {c.paint.name}
                  {c.match === "fuzzy" && <span className="text-xs text-ink-400"> ← {c.name}</span>}
                </span>
              </>
            ) : (
              <span className="text-red-300">
                {c.name} <span className="text-xs">({t.csvImport.conversionMissing})</span>
              </span>
            )}
          </div>
        ))}
      </td>
    </tr>
  );
}
