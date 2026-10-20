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

## 4. Stos (zdecydowany)

Właściciel uczy się na tym projekcie (pierwszy projekt) — priorytet: **prostota i jak najmniej ruchomych części**.

- **Jeden kontener aplikacji:** FastAPI serwuje API pod `/api` oraz zbudowany frontend (pliki statyczne) pod `/`.
- **Backend:** Python 3.12 + FastAPI, SQLAlchemy 2 + Alembic, Pydantic v2. ΔE00 liczone własną, wektorową implementacją w numpy (bez dodatkowych bibliotek kolorymetrycznych).
- **Baza:** **SQLite** w pliku na wolumenie Dockera (`/data/paintrack.db`). Kod pisany przenośnie (SQLAlchemy), żeby w przyszłości dało się przejść na PostgreSQL bez przepisywania.
- **Frontend:** React + TypeScript + Vite, TanStack Query, Tailwind. Budowany w multi-stage Dockerfile (etap Node) — użytkownik **nie** musi mieć Node ani Pythona na komputerze.
- **Docker:** jeden `Dockerfile` + `docker-compose.yml` z jednym serwisem `app`, wolumenem na dane i healthcheckiem. Port domyślny `8080`.
- **Import katalogu:** komenda w tym samym obrazie (`docker compose run --rm app python -m app.importer`); dodatkowo przycisk „Importuj/aktualizuj katalog” w ustawieniach aplikacji. Przy pierwszym starcie z pustą bazą import uruchamia się automatycznie.
- **Platformy docelowe:** Windows (Docker Desktop + WSL2) i macOS (Docker Desktop, Intel i Apple Silicon). Obraz budowany lokalnie, więc działa na obu architekturach (amd64/arm64).

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
- Seed katalogu: automatycznie przy pierwszym starcie lub ręcznie `docker compose run --rm app python -m app.importer` (pobiera dane z repo źródłowego albo z lokalnego katalogu `data/`).
- README pisane dla początkującego: instalacja Docker Desktop na Windows i Mac, uruchomienie krok po kroku, zatrzymanie, aktualizacja, backup (kopiowanie pliku bazy).
- Testy: pytest dla backendu (zwłaszcza konwersji kolorów i ΔE — testy na znanych parach), Vitest dla frontendu.
- Lint/format: ruff + black (Python), eslint + prettier (TS).
- Bez `Makefile` (Windows go nie ma) — wszystkie komendy to zwykłe `docker compose …`, opisane w README.
- Brak sekretów w repo; `.env.example` z domyślnymi wartościami.
- Aplikacja w interfejsie po polsku (z możliwością dodania i18n później); nazwy farb zawsze w oryginale.

## 9. Otwarte decyzje (do ustalenia z właścicielem)

- [x] Stos: jeden kontener (FastAPI + React) + SQLite — patrz §4.
- [x] Hostowanie: lokalnie na Windows i macOS przez Docker Desktop.
- [X] Na razie dostęp tylko lokalnie 
- [x] Docelowe marki w MVP: Citadel/Warhammer Vallejo Game Color, Callejo XpressColor, Army Painter, AK, Green Stuff World
- [x] Dowolnie wybraną markę, z możliwością wyboru w ustawieniach

## 10. Istniejące projekty do podejrzenia (nie kopiować kodu bez sprawdzenia licencji)

- **Lucifix/model-workshop-manager** — self-hosted w Dockerze, katalog modeli/farb/akcesoriów, import 10k+ farb z `miniature-paints`, PWA.
- **ArturSkowronski/minipainter** — lokalny rejestr farb z REST API, matchingiem kolorów i serwerem MCP.
- **Miniature Painter Pro**, **Penzel** — aplikacje mobilne z konwersją między markami (inspiracja UX).
