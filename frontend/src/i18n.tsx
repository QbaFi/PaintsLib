// Interface translations (Polish and English). Paint names are never translated.
//
// To add a text: add a key to `pl`, then TypeScript will require the same key in `en`.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { PaintType, Quality, Status } from "./api";

export type Lang = "pl" | "en";

const pl = {
  nav: { collection: "Kolekcja", catalog: "Katalog", color: "Po kolorze", shopping: "Zakupy", settings: "Ustawienia" },
  common: {
    loading: "Wczytywanie…",
    error: "Coś poszło nie tak:",
    search: "Szukaj…",
    allBrands: "Wszystkie marki",
    anyType: "Każdy typ",
    close: "Zamknij",
    remove: "Usuń z kolekcji",
    discontinued: "wycofana",
    less: "Mniej",
    more: "Więcej",
    saved: "Zapisano ✓",
    owned: "● mam",
    ownedTitle: "Masz tę farbę",
  },
  types: {
    base: "Base",
    layer: "Layer",
    shade: "Shade / wash",
    contrast: "Contrast / speedpaint",
    technical: "Technical / efekty",
    metallic: "Metaliczna",
    dry: "Dry",
    air: "Air (aerograf)",
    primer: "Podkład / spray",
    other: "Inna",
  } satisfies Record<PaintType, string>,
  statuses: { full: "Pełna", low: "Kończy się", empty: "Pusta", wishlist: "Do kupienia" } satisfies Record<Status, string>,
  quality: {
    near_identical: "prawie identyczny",
    close: "bliski",
    similar: "podobny",
    distant: "daleki",
    curated: "potwierdzony",
  } satisfies Record<Quality, string>,
  badge: {
    curated: "✓ potwierdzony",
    curatedTitle: "Odpowiednik potwierdzony ręcznie",
    deltaTitle: (delta: number | null, quality: string) =>
      `ΔE₀₀ = ${delta} (${quality}). Kolory w katalogu są przybliżone.`,
  },
  ownership: {
    have: "+ Mam",
    haveTitle: "Mam tę farbę — dodaj do kolekcji",
    wishlist: "☆ Do kupienia",
    wishlistTitle: "Dodaj do listy zakupów",
    bought: "✓ Kupiona",
  },
  collection: {
    title: "Moja kolekcja",
    subtitle: (n: number, ref: string) => `${n} farb · odpowiedniki: ${ref}`,
    addFromCatalog: "+ Dodaj farby z katalogu",
    statusOwned: "Posiadane",
    statusAll: "Wszystko",
    sortBrand: "Sortuj: marka",
    sortName: "Sortuj: nazwa",
    sortHue: "Sortuj: kolor",
    sortRecent: "Sortuj: ostatnio dodane",
    colPaint: "Farba",
    colQty: "Ilość",
    colStatus: "Stan",
    toBuy: "do kupienia",
    alreadyRef: (ref: string) => `— to już ${ref}`,
    emptyBefore: "Nic tu jeszcze nie ma. Znajdź swoje farby w",
    emptyLink: "katalogu",
    emptyAfter: "i kliknij „+” przy farbie albo zaimportuj arkusz w Ustawieniach.",
  },
  catalog: {
    title: "Katalog farb",
    results: (n: number) => `${n} wyników`,
    hint: "Wyszukaj farbę po nazwie, marce lub linii",
    placeholder: "np. Mephiston, Leadbelcher, 72.010…",
    sortRelevance: "Sortuj: trafność",
    all: "Wszystkie",
    ownedAny: "Posiadane i nie",
    ownedOnly: "Tylko moje",
    ownedNot: "Których nie mam",
    showDiscontinued: "pokaż wycofane",
    empty:
      "Katalog jest pusty — import farb trwa zwykle kilkanaście sekund po pierwszym uruchomieniu. Odśwież stronę za chwilę albo sprawdź zakładkę Ustawienia.",
    noResults: "Nic nie znaleziono. Spróbuj krótszej nazwy.",
    prev: "← Poprzednia",
    next: "Następna →",
    details: (name: string) => `Szczegóły: ${name}`,
  },
  color: {
    title: "Szukaj po kolorze",
    subtitle: "Wybierz kolor, a pokażę najbliższe farby",
    pick: "Wybierz kolor",
    hex: "Kod hex",
    groupAny: "Każdy rodzaj farby",
    groupOpaque: "Kryjące (base, layer…)",
    groupContrast: "Contrast / speedpaint",
    groupShade: "Shade / wash",
    groupTechnical: "Technical / efekty",
    bestPerBrand: "Najlepsza z każdej marki",
    onlyBrand: (b: string) => `Tylko ${b}`,
    ownedFirst: "najpierw moje farby",
    noResults: "Brak farb pasujących do filtrów.",
  },
  shopping: {
    title: "Lista zakupów",
    subtitle: "Farby oznaczone jako „do kupienia”, puste lub kończące się",
    copy: "Kopiuj jako tekst",
    copied: "Skopiowano ✓",
    csv: "Pobierz CSV",
    empty: "Lista jest pusta. W katalogu kliknij „☆”, żeby dodać farbę do kupienia.",
  },
  drawer: {
    closest: (ref: string) => `Najbliższe ${ref}`,
    noMatches: "Brak dopasowań.",
    bestPerBrand: "Najlepszy odpowiednik w każdej marce",
    explain:
      "~ΔE to różnica kolorów (CIEDE2000): poniżej 2 – prawie identyczny, 2–5 – bliski, 5–10 – podobny. Kolory w katalogu są przybliżone, więc przed malowaniem większej partii warto porównać farby na żywo.",
  },
  settings: {
    title: "Ustawienia",
    language: "Język",
    referenceTitle: "Marka referencyjna",
    referenceHelp: "Przy każdej farbie w kolekcji pokazuję najbliższy odpowiednik z tej marki.",
    catalogTitle: "Katalog farb",
    catalogCounts: (paints: number, brands: number, owned: number) =>
      `W bazie: ${paints} farb z ${brands} marek. W kolekcji: ${owned}.`,
    catalogSourceBefore: "Dane pochodzą z otwartego zbioru",
    catalogSourceAfter:
      "(licencja MIT). Aktualizacja nie usuwa Twojej kolekcji ani ręcznie poprawionych kolorów. Uruchom ją też po aktualizacji aplikacji, żeby dociągnąć nowe linie farb.",
    importing: "Importuję…",
    importButton: "Importuj / aktualizuj katalog",
    importFailed: (e: string) => `Ostatni import się nie udał: ${e}`,
    importDone: (created: number, updated: number) =>
      `Ostatni import: ${created} nowych, ${updated} zaktualizowanych.`,
    customTitle: "Dodaj własną farbę",
    customHelp: "Farba spoza katalogu (np. inna marka). Zostanie od razu dodana do Twojej kolekcji.",
    customBrand: "Marka (np. Two Thin Coats)",
    customName: "Nazwa farby",
    customRange: "Linia (opcjonalnie)",
    customColor: "Kolor",
    customSubmit: "Dodaj do kolekcji",
    customAdded: "Dodano ✓",
  },
  csvImport: {
    title: "Import kolekcji z arkusza (CSV)",
    help:
      "Spisz swoje farby w Google Sheets lub Excelu, pobierz arkusz jako CSV (Plik → Pobierz → CSV) i wybierz go tutaj. Wymagane kolumny: Brand i Colour. Kolumna Conversion to Twoje odpowiedniki — zapiszą się jako „potwierdzone”. Kilka odpowiedników oddziel znakiem /.",
    template: "Pobierz szablon CSV",
    choose: "Wybierz plik CSV",
    previewing: "Sprawdzam plik…",
    previewNote: "To tylko podgląd — nic jeszcze nie zostało zapisane.",
    confirm: (n: number) => `Importuj ${n} farb`,
    importing: "Importuję…",
    done: "Zaimportowano ✓",
    again: "Importuj inny plik",
    summary: (s: { added: number; updated: number; unchanged: number; skipped: number; equivalents_added: number }) =>
      `Nowe: ${s.added} · zmienione: ${s.updated} · bez zmian: ${s.unchanged} · pominięte: ${s.skipped} · nowe odpowiedniki: ${s.equivalents_added}`,
    unknownColumns: (cols: string) => `Nierozpoznane kolumny (zostaną pominięte): ${cols}`,
    colLine: "Wiersz",
    colInput: "W pliku",
    colMatch: "Dopasowanie",
    colConversion: "Odpowiedniki",
    match: {
      exact: "znaleziono",
      fuzzy: "przybliżone — sprawdź",
      not_found: "nie znaleziono",
      unknown_brand: "nieznana marka",
      invalid: "błędny wiersz",
    },
    action: { added: "nowa", updated: "zmiana", unchanged: "bez zmian", skipped: "pominięta" },
    suggestion: (name: string) => `Może chodziło o: ${name}?`,
    conversionMissing: "brak w katalogu",
    filterProblems: "Pokaż tylko problemy",
  },
};

export type Dict = typeof pl;

const en: Dict = {
  nav: { collection: "Collection", catalog: "Catalog", color: "By colour", shopping: "Shopping", settings: "Settings" },
  common: {
    loading: "Loading…",
    error: "Something went wrong:",
    search: "Search…",
    allBrands: "All brands",
    anyType: "Any type",
    close: "Close",
    remove: "Remove from collection",
    discontinued: "discontinued",
    less: "Less",
    more: "More",
    saved: "Saved ✓",
    owned: "● owned",
    ownedTitle: "You own this paint",
  },
  types: {
    base: "Base",
    layer: "Layer",
    shade: "Shade / wash",
    contrast: "Contrast / speedpaint",
    technical: "Technical / effects",
    metallic: "Metallic",
    dry: "Dry",
    air: "Air (airbrush)",
    primer: "Primer / spray",
    other: "Other",
  },
  statuses: { full: "Full", low: "Running low", empty: "Empty", wishlist: "To buy" },
  quality: {
    near_identical: "near identical",
    close: "close",
    similar: "similar",
    distant: "distant",
    curated: "confirmed",
  },
  badge: {
    curated: "✓ confirmed",
    curatedTitle: "Equivalent confirmed by hand",
    deltaTitle: (delta, quality) => `ΔE₀₀ = ${delta} (${quality}). Catalog colours are approximate.`,
  },
  ownership: {
    have: "+ I have it",
    haveTitle: "I have this paint — add to collection",
    wishlist: "☆ To buy",
    wishlistTitle: "Add to shopping list",
    bought: "✓ Bought",
  },
  collection: {
    title: "My collection",
    subtitle: (n, ref) => `${n} paints · equivalents: ${ref}`,
    addFromCatalog: "+ Add paints from the catalog",
    statusOwned: "Owned",
    statusAll: "Everything",
    sortBrand: "Sort: brand",
    sortName: "Sort: name",
    sortHue: "Sort: colour",
    sortRecent: "Sort: recently added",
    colPaint: "Paint",
    colQty: "Qty",
    colStatus: "Status",
    toBuy: "to buy",
    alreadyRef: (ref) => `— already ${ref}`,
    emptyBefore: "Nothing here yet. Find your paints in the",
    emptyLink: "catalog",
    emptyAfter: "and click “+” next to a paint, or import a spreadsheet in Settings.",
  },
  catalog: {
    title: "Paint catalog",
    results: (n) => `${n} results`,
    hint: "Search paints by name, brand or range",
    placeholder: "e.g. Mephiston, Leadbelcher, 72.010…",
    sortRelevance: "Sort: relevance",
    all: "All",
    ownedAny: "Owned or not",
    ownedOnly: "Only mine",
    ownedNot: "Ones I don't have",
    showDiscontinued: "show discontinued",
    empty:
      "The catalog is empty — the paint import usually takes a few seconds after the first start. Refresh in a moment or check Settings.",
    noResults: "Nothing found. Try a shorter name.",
    prev: "← Previous",
    next: "Next →",
    details: (name) => `Details: ${name}`,
  },
  color: {
    title: "Search by colour",
    subtitle: "Pick a colour and I'll show the closest paints",
    pick: "Pick a colour",
    hex: "Hex code",
    groupAny: "Any kind of paint",
    groupOpaque: "Opaque (base, layer…)",
    groupContrast: "Contrast / speedpaint",
    groupShade: "Shade / wash",
    groupTechnical: "Technical / effects",
    bestPerBrand: "Best from every brand",
    onlyBrand: (b) => `Only ${b}`,
    ownedFirst: "my paints first",
    noResults: "No paints match these filters.",
  },
  shopping: {
    title: "Shopping list",
    subtitle: "Paints marked “to buy”, empty or running low",
    copy: "Copy as text",
    copied: "Copied ✓",
    csv: "Download CSV",
    empty: "The list is empty. Click “☆” in the catalog to add a paint to buy.",
  },
  drawer: {
    closest: (ref) => `Closest ${ref}`,
    noMatches: "No matches.",
    bestPerBrand: "Best equivalent in every brand",
    explain:
      "~ΔE is the colour difference (CIEDE2000): below 2 – near identical, 2–5 – close, 5–10 – similar. Catalog colours are approximate, so compare paints in person before painting a big batch.",
  },
  settings: {
    title: "Settings",
    language: "Language",
    referenceTitle: "Reference brand",
    referenceHelp: "Every paint in your collection shows its closest equivalent from this brand.",
    catalogTitle: "Paint catalog",
    catalogCounts: (paints, brands, owned) => `In the database: ${paints} paints from ${brands} brands. In your collection: ${owned}.`,
    catalogSourceBefore: "Data comes from the open",
    catalogSourceAfter:
      "dataset (MIT licence). Updating never removes your collection or colours you fixed by hand. Run it after updating the app too, to pull in new paint ranges.",
    importing: "Importing…",
    importButton: "Import / update catalog",
    importFailed: (e) => `The last import failed: ${e}`,
    importDone: (created, updated) => `Last import: ${created} new, ${updated} updated.`,
    customTitle: "Add your own paint",
    customHelp: "A paint that isn't in the catalog (e.g. another brand). It's added to your collection right away.",
    customBrand: "Brand (e.g. Two Thin Coats)",
    customName: "Paint name",
    customRange: "Range (optional)",
    customColor: "Colour",
    customSubmit: "Add to collection",
    customAdded: "Added ✓",
  },
  csvImport: {
    title: "Import your collection from a spreadsheet (CSV)",
    help:
      "List your paints in Google Sheets or Excel, download the sheet as CSV (File → Download → CSV) and pick it here. Required columns: Brand and Colour. The Conversion column holds your own equivalents — they're saved as “confirmed”. Separate several equivalents with /.",
    template: "Download CSV template",
    choose: "Choose a CSV file",
    previewing: "Checking the file…",
    previewNote: "This is only a preview — nothing has been saved yet.",
    confirm: (n) => `Import ${n} paints`,
    importing: "Importing…",
    done: "Imported ✓",
    again: "Import another file",
    summary: (s) =>
      `New: ${s.added} · changed: ${s.updated} · unchanged: ${s.unchanged} · skipped: ${s.skipped} · new equivalents: ${s.equivalents_added}`,
    unknownColumns: (cols) => `Unrecognised columns (ignored): ${cols}`,
    colLine: "Row",
    colInput: "In the file",
    colMatch: "Match",
    colConversion: "Equivalents",
    match: {
      exact: "found",
      fuzzy: "approximate — check",
      not_found: "not found",
      unknown_brand: "unknown brand",
      invalid: "invalid row",
    },
    action: { added: "new", updated: "changed", unchanged: "unchanged", skipped: "skipped" },
    suggestion: (name) => `Did you mean: ${name}?`,
    conversionMissing: "not in catalog",
    filterProblems: "Show problems only",
  },
};

const DICTS: Record<Lang, Dict> = { pl, en };
const STORAGE_KEY = "paintslib.lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "pl" || saved === "en") return saved;
  } catch {
    /* storage unavailable */
  }
  return navigator.language?.toLowerCase().startsWith("pl") ? "pl" : "en";
}

interface I18nValue {
  lang: Lang;
  t: Dict;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nValue>({ lang: "pl", t: pl, setLang: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return <I18nContext.Provider value={{ lang, t: DICTS[lang], setLang }}>{children}</I18nContext.Provider>;
}

/** `const { t, lang, setLang } = useI18n();` then `t.nav.catalog`. */
export function useI18n() {
  return useContext(I18nContext);
}

export function useT(): Dict {
  return useContext(I18nContext).t;
}

export function LanguageSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-ink-600 text-xs" role="group" aria-label="Language">
      {(["pl", "en"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2 py-1 font-semibold uppercase ${
            lang === l ? "bg-brass-500 text-ink-950" : "text-ink-400 hover:text-ink-200"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
