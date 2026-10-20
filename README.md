# PaintsLib

Aplikacja do prowadzenia spisu farb modelarskich (Warhammer i inne miniaturki).

- **Katalog** ok. 2500 farb: Citadel, Vallejo (Game Color, Xpress Color), The Army Painter, AK Interactive, Green Stuff World
- **Moja kolekcja**: ilość, stan (pełna / kończy się / pusta / do kupienia), tagi
- przy każdej farbie **najbliższy odpowiednik** z wybranej marki (domyślnie Citadel) z miarą podobieństwa ΔE
- **szukanie po kolorze** (color picker), **lista zakupów** z eksportem do CSV
- możliwość dodania własnej farby spoza katalogu

Całość działa w Dockerze. Na komputerze nie musisz mieć Pythona, Node.js ani gita.

---

## 1. Zainstaluj Docker Desktop (jednorazowo)

**macOS**
1. Pobierz Docker Desktop: https://www.docker.com/products/docker-desktop/. Wybierz wersję **Apple Silicon** (Mac z procesorem M1/M2/M3/M4) albo **Intel**. Którą masz, sprawdzisz w  → *Ten Mac*.
2. Otwórz pobrany plik `.dmg` i przeciągnij Dockera do *Aplikacji*.
3. Uruchom Docker Desktop i poczekaj, aż ikonka wieloryba na górnym pasku przestanie „pływać”.

**Windows**
1. Pobierz Docker Desktop z tej samej strony i uruchom instalator.
2. Gdy instalator zapyta o **WSL 2**, zostaw zaznaczone. Po instalacji może być potrzebny restart komputera.
3. Uruchom Docker Desktop i poczekaj, aż na dole okna pojawi się *Engine running*.

> Docker potrzebuje kilku GB wolnego miejsca na dysku. Najlepiej mieć co najmniej 10 GB zapasu.

## 2. Pobierz projekt

Na stronie repozytorium na GitHubie kliknij zielony przycisk **Code → Download ZIP** i rozpakuj plik, np. do folderu `Dokumenty/PaintsLib`.

(Jeśli masz gita: `git clone https://github.com/QbaFi/PaintsLib.git`.)

## 3. Uruchom aplikację

Otwórz terminal **w folderze projektu**:

- **macOS:** w Finderze kliknij folder prawym przyciskiem → *Usługi* → *Nowy terminal w folderze*. Możesz też otworzyć Terminal, wpisać `cd ` (ze spacją) i przeciągnąć folder do okna.
- **Windows:** otwórz folder w Eksploratorze, kliknij w pasek adresu, wpisz `powershell` i naciśnij Enter.

Wpisz:

```
docker compose up -d --build
```

Pierwsze uruchomienie trwa kilka minut, bo Docker buduje obraz aplikacji. Kolejne starty są szybkie.

Otwórz w przeglądarce: **http://localhost:8080**

Przy pierwszym starcie aplikacja sama pobiera katalog farb, co zajmuje kilkanaście sekund. Jeśli katalog jest pusty, odśwież stronę po chwili.

## Codzienne użycie

| Co chcesz zrobić | Komenda (w folderze projektu) |
|---|---|
| Zatrzymać aplikację | `docker compose down` |
| Uruchomić ponownie | `docker compose up -d` |
| Zobaczyć logi (gdy coś nie działa) | `docker compose logs -f` (wyjście: Ctrl+C) |
| Zaktualizować po zmianach w kodzie | pobierz nowy ZIP, potem `docker compose up -d --build` |

Twoje dane (kolekcja, ustawienia) są w wolumenie Dockera `paintslib-data`. **Nie znikają** po zatrzymaniu, aktualizacji ani przebudowie aplikacji. Usunąłby je dopiero `docker compose down -v`, więc **nie używaj `-v`**, chyba że chcesz zacząć od zera.

### Kopia zapasowa

```
docker compose stop
docker compose cp app:/data/paintrack.db ./paintrack-backup.db
docker compose start
```

Przywracanie:

```
docker compose stop
docker compose cp ./paintrack-backup.db app:/data/paintrack.db
docker compose start
```

Do szybkiej kopii samej kolekcji wystarczy też eksport CSV na stronie *Lista zakupów* albo adres `http://localhost:8080/api/inventory/export.csv`.

### Ustawienia (opcjonalnie)

Skopiuj `.env.example` jako `.env` i zmień wartości, np. port albo import wszystkich marek (ok. 10 tys. farb). Potem uruchom `docker compose up -d`.

Aplikacja domyślnie jest dostępna **tylko z tego komputera**. Żeby otworzyć ją np. z telefonu w tej samej sieci Wi-Fi, w `docker-compose.yml` zmień `"127.0.0.1:${PORT:-8080}:8000"` na `"${PORT:-8080}:8000"`. Nie ma logowania, więc rób to tylko w zaufanej sieci domowej.

---

## Jak to działa (dla ciekawych)

```
PaintsLib/
├── Dockerfile            # buduje frontend (Node), potem obraz z Pythonem
├── docker-compose.yml    # jeden serwis "app" + wolumen na bazę
├── backend/              # FastAPI + SQLAlchemy + SQLite
│   ├── app/
│   │   ├── main.py       # start aplikacji, serwowanie frontendu
│   │   ├── routers/      # endpointy API (/api/paints, /api/inventory, /api/settings…)
│   │   ├── color.py      # sRGB → Lab, odległość kolorów CIEDE2000
│   │   ├── matching.py   # szukanie najbliższych farb
│   │   ├── catalog.py    # które marki/linie importować i jak rozpoznać typ farby
│   │   └── importer.py   # import katalogu z miniature-paints
│   ├── alembic/          # migracje bazy danych
│   └── tests/
└── frontend/             # React + TypeScript + Vite + Tailwind
    └── src/pages/        # ekrany: Kolekcja, Katalog, Po kolorze, Zakupy, Ustawienia
```

- **Dopasowanie kolorów:** kolory są zamieniane na przestrzeń CIE Lab i porównywane wzorem **CIEDE2000**, który lepiej oddaje ludzkie postrzeganie niż zwykła różnica RGB. ΔE < 2 to prawie identyczny kolor, 2–5 bliski, 5–10 podobny. Washe, contrasty i farby kryjące są porównywane tylko w swoich grupach.
- **Dane o farbach** pochodzą z otwartego zbioru [Arcturus5404/miniature-paints](https://github.com/Arcturus5404/miniature-paints) (licencja MIT). Kolory są przybliżone, bo pochodzą ze zdjęć i próbek, a nie z pomiarów.
- **Dokumentacja API** jest dostępna pod http://localhost:8080/docs po uruchomieniu aplikacji.
- **Automatyczne testy** uruchamiają się na GitHubie przy każdej zmianie (zakładka *Actions*).

### Praca nad kodem bez Dockera (opcjonalnie)

Wymaga Pythona 3.12 i Node.js 22.

```
# backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
export DATABASE_URL=sqlite:///./dev.db               # Windows: $env:DATABASE_URL="sqlite:///./dev.db"
alembic upgrade head
uvicorn app.main:app --reload
pytest

# frontend (w drugim terminalu)
cd frontend
npm install
npm run dev     # http://localhost:5173
```
