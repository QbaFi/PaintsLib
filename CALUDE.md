# Paint Rack — kontekst projektu

> Plik kontekstowy dla asystenta AI (Claude Code / Claude). Umieść go w katalogu głównym repozytorium jako `CLAUDE.md`.
> Język komunikacji z właścicielem projektu: **polski**. Kod, nazwy w kodzie, commity i komentarze: **angielski**.

## 1. Cel

Samodzielnie hostowana aplikacja webowa do prowadzenia spisu farb modelarskich (Warhammer i inne miniaturki).
Użytkownik:

1. przegląda **katalog** farb różnych marek (Citadel, Vallejo, Army Painter, AK, Scale75, Two Thin Coats, Reaper, P3, …) z próbką koloru,
2. **wyszukuje** farby po nazwie, marce, linii (Base, Layer, Shade, Contrast…) i po kolorze (hex / color picker),
3. **dodaje farby do swojej kolekcji** (inwentarza) z ilością i stanem (pełna / kończy się / pusta / na liście zakupów),
4. na ekranie spisu widzi przy każdej farbie **najbliższy odpowiednik Citadel** (i opcjonalnie innych marek) z miarą podobieństwa.

Aplikacja jednoużytkownikowa (prywatny homelab), działa w całości w Dockerze, uruchamiana jednym `docker compose up -d`.

## 2. Źródła danych o farbach

Nie ma oficjalnego API producentów (Games Workshop, Vallejo itd. nie udostępniają publicznych API z kolorami). Opieramy się na otwartych zbiorach danych importowanych lokalnie do bazy:

| Źródło | Co zawiera | Licencja / uwagi |
|---|---|---|
| **github.com/Arcturus5404/miniature-paints** | Tabele markdown per marka: nazwa, linia/zestaw, wartości RGB/hex. ~25+ marek, w tym Citadel, Vallejo, Army Painter, AK, Scale75, Reaper, P3. | MIT. **Główne źródło seedu.** Dostępne też jako paczka npm `miniature-paints`. |
| **dakkadakka.com — Paint Range Compatibility Chart** | Ręcznie zebrane, społecznościowe odpowiedniki Citadel ↔ inne marki (w tym stare nazwy Citadel). | Tylko jako inspiracja / ręczna weryfikacja; nie scrapować automatycznie. |
| **github.com/ArturSkowronski/minipainter** | Katalog ~1600 farb (Citadel, Army Painter, Vallejo, AK) + gotowe REST API i matching kolorów. | Do porównania podejścia; ewentualnie dodatkowe źródło danych po sprawdzeniu licencji. |

Zasady:
- Dane katalogu są **lokalne** (seed w bazie), aplikacja działa offline. Brak zależności od zewnętrznego API w runtime.
- Import realizuje skrypt `importer` (osobny serwis/komenda), idempotentny (upsert po `brand + name + range`), z możliwością ponownego uruchomienia przy aktualizacji źródła.
- Hex/RGB to **przybliżenia** zdjęć/próbek — UI musi to komunikować (np. ikonka „~” przy dopasowaniu).
- Użytkownik może ręcznie dodać farbę spoza katalogu (marka, nazwa, hex) i ręcznie nadpisać hex.

## 3. Konwersja kolorów (odpowiedniki Citadel)

Dwa mechanizmy, w tej kolejności priorytetu:

1. **Ręczne/kurowane mapowania** (tabela `paint_equivalents`) — jeśli istnieje, pokazujemy je jako „potwierdzone”.
2. **Automatyczne dopasowanie po kolorze**:
   - konwersja sRGB → CIE L\*a\*b\* (D65),
   - odległość **CIEDE2000 (ΔE00)**, nie zwykła odległość RGB,
   - zwracamy top N (domyślnie 3) najbliższych farb z marki docelowej,
   - progi jakości: ΔE < 2 „prawie identyczny”, 2–5 „bliski”, 5–10 „podobny”, > 10 „daleki”.
   - Opcjonalny filtr: dopasowuj w obrębie tego samego typu farby (base↔base, layer↔layer; shade/contrast/technical osobno — porównywanie washa z farbą kryjącą jest mylące).
   - Opcja „najpierw z mojej kolekcji” — preferuj farby, które użytkownik już posiada.
- Wyniki dopasowań można prekalkulować przy imporcie (tabela cache) — katalog ma kilka-kilkanaście tys. pozycji, więc liczenie on-the-fly też jest akceptowalne.

## 4. Proponowany stos (do potwierdzenia)

- **Backend:** Python 3.12 + FastAPI, SQLAlchemy 2 + Alembic, Pydantic v2. Kolorymetria: `colormath` lub `coloraide` (ΔE00).
- **Baza:** PostgreSQL 16 (wyszukiwanie: `pg_trgm` do fuzzy po nazwie).
- **Frontend:** React + TypeScript + Vite, TanStack Query, Tailwind. Budowany w multi-stage Dockerfile i serwowany przez nginx.
- **Reverse proxy:** nginx w kontenerze frontendu (`/api` → backend).
- **Docker:** `docker compose` z serwisami `db`, `api`, `web`, `importer` (profil uruchamiany ręcznie). Wolumen na dane Postgresa, healthchecki, `.env` z przykładem `.env.example`. Obrazy multi-arch (amd64/arm64) — możliwość uruchomienia na Raspberry Pi / NAS.

Alternatywa prostsza: jeden kontener (FastAPI serwujący zbudowany frontend) + SQLite na wolumenie. Wybór do decyzji właściciela (patrz §9).

## 5. Model danych (szkic)

```
brand(id, name, slug, website)
paint_range(id, brand_id, name)                 -- np. "Base", "Layer", "Game Color", "Speedpaint 2.0"
paint(id, brand_id, range_id, name, hex, r, g, b,
      lab_l, lab_a, lab_b,                      -- prekalkulowane
      type,                                     -- base|layer|shade|contrast|technical|metallic|dry|air|primer|other
      finish, discontinued bool, source, source_ref, created_at, updated_at)
paint_equivalent(paint_id, equivalent_paint_id, kind: curated|computed, delta_e, note)
inventory_item(id, paint_id, quantity, status: full|low|empty|wishlist,
               purchased_at, note, custom_hex_override)
tag(id, name) / inventory_item_tag(...)         -- np. "Ultramarines", "projekt X"
```

## 6. Ekrany (MVP)

1. **Moja kolekcja** — tabela/siatka: próbka koloru, marka, linia, nazwa, ilość, status, **kolumna „Citadel ≈”** z próbką i nazwą najbliższego odpowiednika + ΔE. Filtry: marka, typ, status, tag; sortowanie po nazwie, marce, odcieniu (hue).
2. **Katalog** — wyszukiwarka (nazwa z fuzzy match, marka, linia, typ), przycisk „dodaj do kolekcji”, oznaczenie „posiadam”.
3. **Szukaj po kolorze** — color picker / pole hex → najbliższe farby z każdej marki, z zaznaczeniem posiadanych.
4. **Szczegóły farby** — duża próbka, odpowiedniki we wszystkich markach, historia/ilość w kolekcji.
5. **Lista zakupów** — farby ze statusem `low`/`empty`/`wishlist`, eksport do CSV/tekstu.

Później (poza MVP): import/eksport kolekcji (CSV/JSON), backup bazy, PWA na telefon, skanowanie kodów kreskowych, „przepisy” malowania (schematy kolorów dla armii), wielu użytkowników.

## 7. API (szkic REST)

```
GET    /api/brands
GET    /api/paints?q=&brand=&range=&type=&owned=&page=
GET    /api/paints/{id}
GET    /api/paints/{id}/equivalents?brand=citadel&limit=3&same_type=true
GET    /api/match?hex=1a2b3c&brand=citadel&limit=5&owned_first=true
POST   /api/paints                      # farba własna spoza katalogu
GET    /api/inventory?status=&brand=&tag=
POST   /api/inventory                   # {paint_id, quantity, status}
PATCH  /api/inventory/{id}
DELETE /api/inventory/{id}
GET    /api/health
```
OpenAPI generowane automatycznie przez FastAPI (`/docs`).

## 8. Wymagania niefunkcjonalne / konwencje

- Całość uruchamialna przez `docker compose up -d`; zero ręcznej konfiguracji poza `.env`.
- Migracje Alembic uruchamiane automatycznie przy starcie `api`.
- Seed katalogu: `docker compose run --rm importer` (pobiera dane z repo źródłowego przy buildzie obrazu albo z lokalnego katalogu `data/`).
- Testy: pytest dla backendu (zwłaszcza konwersji kolorów i ΔE — testy na znanych parach), Vitest dla frontendu.
- Lint/format: ruff + black (Python), eslint + prettier (TS).
- Prosty `Makefile` z celami: `up`, `down`, `logs`, `seed`, `test`, `backup`.
- Brak sekretów w repo; `.env.example` z domyślnymi wartościami.
- Aplikacja w interfejsie po polsku (z możliwością dodania i18n później); nazwy farb zawsze w oryginale.

## 9. Otwarte decyzje (do ustalenia z właścicielem)

- [ ] Stos: FastAPI + Postgres + React (domyślny) vs. prostszy jeden kontener + SQLite vs. inny język (np. Node/NestJS, .NET, Go)?
- [ ] Gdzie będzie hostowane (PC, NAS, Raspberry Pi, VPS)? → wpływa na arch obrazów i bazę.
- [ ] Czy potrzebne logowanie (dostęp z internetu) czy tylko sieć lokalna?
- [ ] Docelowe marki w MVP (sugestia: Citadel, Vallejo Game/Model Color, Army Painter, AK 3rd Gen, Two Thin Coats).
- [ ] Czy pokazywać odpowiedniki tylko Citadel, czy dowolnie wybraną „markę referencyjną” w ustawieniach?

## 10. Istniejące projekty do podejrzenia (nie kopiować kodu bez sprawdzenia licencji)

- **Lucifix/model-workshop-manager** — self-hosted w Dockerze, katalog modeli/farb/akcesoriów, import 10k+ farb z `miniature-paints`, PWA.
- **ArturSkowronski/minipainter** — lokalny rejestr farb z REST API, matchingiem kolorów i serwerem MCP.
- **Miniature Painter Pro**, **Penzel** — aplikacje mobilne z konwersją między markami (inspiracja UX).
