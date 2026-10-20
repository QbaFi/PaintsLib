// Typed client for the PaintsLib backend (FastAPI, see backend/app/routers).

export type PaintType =
  | "base" | "layer" | "shade" | "contrast" | "technical"
  | "metallic" | "dry" | "air" | "primer" | "other";
export type Status = "full" | "low" | "empty" | "wishlist";
export type Quality = "near_identical" | "close" | "similar" | "distant" | "curated";

export interface Brand {
  id: number;
  slug: string;
  name: string;
  paint_count: number;
}

export interface Paint {
  id: number;
  name: string;
  range_name: string;
  code: string | null;
  hex: string;
  type: PaintType;
  discontinued: boolean;
  custom: boolean;
  brand: Brand;
  owned: boolean;
  inventory_id: number | null;
  inventory_status: Status | null;
  inventory_quantity: number | null;
}

export interface PaintPage {
  items: Paint[];
  total: number;
  page: number;
  page_size: number;
}

export interface Match {
  paint: Paint;
  delta_e: number | null;
  quality: Quality;
}

export interface InventoryItem {
  id: number;
  quantity: number;
  status: Status;
  purchased_at: string | null;
  note: string | null;
  tags: string[];
  paint: Paint;
  reference_match: Match | null;
}

export interface CatalogStatus {
  running: boolean;
  finished_at: string | null;
  error: string | null;
  result: { brands: number; created: number; updated: number; skipped: number; per_brand: Record<string, number> } | null;
  paint_count: number;
  brand_count: number;
  inventory_count: number;
}

export type ImportMatch = "exact" | "fuzzy" | "not_found" | "unknown_brand" | "invalid";
export type ImportAction = "added" | "updated" | "unchanged" | "skipped";

export interface ImportRow {
  line: number;
  brand: string;
  series: string;
  name: string;
  match: ImportMatch;
  action: ImportAction;
  paint: Paint | null;
  suggestion: Paint | null;
  error: string | null;
  conversions: { name: string; match: ImportMatch; paint: Paint | null }[];
}

export interface ImportReport {
  dry_run: boolean;
  summary: {
    rows: number;
    added: number;
    updated: number;
    unchanged: number;
    skipped: number;
    fuzzy: number;
    equivalents_added: number;
    unknown_columns: string[];
  };
  rows: ImportRow[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Params = Record<string, string | number | boolean | undefined | null>;

function query(params?: Params): string {
  if (!params) return "";
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

async function request<T>(method: string, path: string, body?: unknown, params?: Params): Promise<T> {
  const res = await fetch(`/api${path}${query(params)}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      message = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, message);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  brands: () => request<Brand[]>("GET", "/brands"),
  paints: (params: Params) => request<PaintPage>("GET", "/paints", undefined, params),
  paint: (id: number) => request<Paint>("GET", `/paints/${id}`),
  createPaint: (body: { brand_name: string; name: string; range_name?: string; hex: string; type: PaintType }) =>
    request<Paint>("POST", "/paints", body),
  updatePaint: (id: number, body: { hex?: string; type?: PaintType }) => request<Paint>("PATCH", `/paints/${id}`, body),
  equivalents: (id: number, params: Params) => request<Match[]>("GET", `/paints/${id}/equivalents`, undefined, params),
  match: (params: Params) => request<Match[]>("GET", "/match", undefined, params),

  inventory: (params: Params) => request<InventoryItem[]>("GET", "/inventory", undefined, params),
  addToInventory: (body: { paint_id: number; quantity?: number; status?: Status }) =>
    request<InventoryItem>("POST", "/inventory", body),
  updateInventory: (id: number, body: Partial<Pick<InventoryItem, "quantity" | "status" | "note" | "tags">>) =>
    request<InventoryItem>("PATCH", `/inventory/${id}`, body),
  removeFromInventory: (id: number) => request<void>("DELETE", `/inventory/${id}`),

  settings: () => request<{ reference_brand: string }>("GET", "/settings"),
  saveSettings: (body: { reference_brand: string }) => request<{ reference_brand: string }>("PUT", "/settings", body),
  catalogStatus: () => request<CatalogStatus>("GET", "/catalog/status"),
  startImport: () => request<{ started: boolean }>("POST", "/catalog/import"),
  importCollection: (csv: string, dryRun: boolean) =>
    request<ImportReport>("POST", "/inventory/import", { csv, dry_run: dryRun }),
};
