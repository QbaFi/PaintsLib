import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { PaintDrawerProvider } from "./components/PaintDrawer";
import { LanguageSwitch, useT } from "./i18n";
import { CatalogPage } from "./pages/Catalog";
import { CollectionPage } from "./pages/Collection";
import { ColorSearchPage } from "./pages/ColorSearch";
import { SettingsPage } from "./pages/Settings";
import { ShoppingPage } from "./pages/Shopping";

export function App() {
  const t = useT();
  const NAV = [
    { to: "/", label: t.nav.collection, end: true },
    { to: "/catalog", label: t.nav.catalog },
    { to: "/color", label: t.nav.color },
    { to: "/shopping", label: t.nav.shopping },
    { to: "/settings", label: t.nav.settings },
  ];
  return (
    <PaintDrawerProvider>
      <header className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="h-7 w-7" />
            <span className="font-display text-xl tracking-wider text-brass-300">PaintsLib</span>
          </NavLink>
          <nav className="flex flex-wrap gap-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm ${
                    isActive ? "bg-brass-500/15 text-brass-300" : "text-ink-400 hover:text-ink-200"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <LanguageSwitch />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Routes>
          <Route path="/" element={<CollectionPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/color" element={<ColorSearchPage />} />
          <Route path="/shopping" element={<ShoppingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </PaintDrawerProvider>
  );
}
