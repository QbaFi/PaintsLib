# PaintsLib

Aplikacja do prowadzenia spisu farb modelarskich (Warhammer i inne miniaturki).

- **Katalog** ok. 2500 farb: Citadel, Vallejo (Game Color, Xpress Color), The Army Painter, AK Interactive, Green Stuff World
- **Moja kolekcja**: ilość, stan (pełna / kończy się / pusta / do kupienia), tagi
- przy każdej farbie **najbliższy odpowiednik** z wybranej marki (domyślnie Citadel) z miarą podobieństwa ΔE
- **szukanie po kolorze** (color picker), **lista zakupów** z eksportem do CSV
- możliwość dodania własnej farby spoza katalogu

Całość działa w Dockerze. Na komputerze nie musisz mieć Pythona ani Node.js.

**Wybierz jeden z dwóch sposobów:**

| | Opcja A: Docker Desktop | Opcja B: tylko terminal |
|---|---|---|
| Dla kogo | wolisz klikać, chcesz widzieć kontenery w okienku | nie boisz się wpisać kilku komend |
| Instalacja | pobierasz aplikację ze strony Dockera | kilka komend w terminalu |
| Zajmowane miejsce | większe (aplikacja + maszyna wirtualna) | mniejsze (sam silnik Dockera) |
| Licencja | darmowy do użytku prywatnego | w pełni open source |

Od kroku 3 („Uruchom aplikację”) obie opcje działają tak samo, bo komendy `docker compose …` są identyczne.

---

## 1A. Opcja A: zainstaluj Docker Desktop (jednorazowo)

**macOS**
1. Pobierz Docker Desktop: https://www.docker.com/products/docker-desktop/. Wybierz wersję **Apple Silicon** (Mac z procesorem M1/M2/M3/M4) albo **Intel**. Którą masz, sprawdzisz w  → *Ten Mac*.
2. Otwórz pobrany plik `.dmg` i przeciągnij Dockera do *Aplikacji*.
3. Uruchom Docker Desktop i poczekaj, aż ikonka wieloryba na górnym pasku przestanie „pływać”.

**Windows**
1. Pobierz Docker Desktop z tej samej strony i uruchom instalator.
2. Gdy instalator zapyta o **WSL 2**, zostaw zaznaczone. Po instalacji może być potrzebny restart komputera.
3. Uruchom Docker Desktop i poczekaj, aż na dole okna pojawi się *Engine running*.

> Docker potrzebuje kilku GB wolnego miejsca na dysku. Najlepiej mieć co najmniej 10 GB zapasu.

Potem przejdź do kroku **2. Pobierz projekt**.

## 1B. Opcja B: Docker tylko z terminala (jednorazowo)

### macOS: Homebrew + Colima

Colima to lekki, darmowy silnik Dockera dla Maca, bez aplikacji z okienkiem.

1. Otwórz **Terminal** (Cmd + Spacja, wpisz „Terminal”).
2. Zainstaluj **Homebrew**, menedżer programów dla Maca. Jeśli już go masz, pomiń ten krok. Wklej:
   ```
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   Instalator zapyta o hasło do Maca (podczas wpisywania nic się nie wyświetla, to normalne) i może doinstalować *Command Line Tools* od Apple. Na końcu pokaże komendy z sekcji **„Next steps”**. Skopiuj je i wykonaj, żeby terminal widział polecenie `brew`.
3. Zainstaluj Dockera, Docker Compose i Colimę:
   ```
   brew install docker docker-compose colima
   ```
4. Powiedz Dockerowi, gdzie jest Compose (jednorazowo):
   ```
   mkdir -p ~/.docker && echo '{"cliPluginsExtraDirs": ["'"$(brew --prefix)"'/lib/docker/cli-plugins"]}' > ~/.docker/config.json
   ```
5. Uruchom silnik Dockera:
   ```
   colima start
   ```
6. Sprawdź, czy działa: `docker compose version` powinno wypisać numer wersji.

> **Po każdym restarcie Maca** uruchom najpierw `colima start`. Zatrzymanie silnika i zwolnienie pamięci RAM: `colima stop`.

### Windows: WSL (Ubuntu) + Docker Engine

Na Windowsie Docker działa wewnątrz **WSL**, czyli wbudowanego w Windows Linuksa. Wszystkie komendy wpisujesz potem w oknie **Ubuntu**.

1. Kliknij Start, wpisz `PowerShell`, kliknij prawym przyciskiem → **Uruchom jako administrator**.
2. Zainstaluj WSL z Ubuntu:
   ```
   wsl --install
   ```
   Zrestartuj komputer, gdy Windows o to poprosi.
3. Po restarcie otworzy się okno **Ubuntu** (albo uruchom je z menu Start). Ustaw nazwę użytkownika i hasło dla Linuksa; mogą być inne niż w Windowsie. Przy wpisywaniu hasła nic się nie wyświetla, to normalne.
4. W oknie Ubuntu zainstaluj Dockera:
   ```
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER
   ```
5. Zamknij okno Ubuntu i otwórz je ponownie, żeby zmiany uprawnień zadziałały.
6. Sprawdź, czy działa: `docker compose version` powinno wypisać numer wersji.
   Jeśli pojawi się błąd *Cannot connect to the Docker daemon*, uruchom `sudo service docker start`.

> W opcji B na Windowsie **pobierz projekt i uruchamiaj komendy w oknie Ubuntu**, a nie w PowerShellu (patrz krok 2).

## 2. Pobierz projekt

**Opcja A (Mac i Windows) oraz opcja B na Macu:** na stronie repozytorium na GitHubie kliknij zielony przycisk **Code → Download ZIP** i rozpakuj plik, np. do folderu `Dokumenty/PaintsLib`.

**Opcja B na Windowsie (w oknie Ubuntu):**
```
git clone https://github.com/QbaFi/PaintsLib.git
cd PaintsLib
```

(Jeśli masz gita na Macu, możesz też użyć `git clone` zamiast ZIP-a.)

## 3. Uruchom aplikację

Otwórz terminal **w folderze projektu**:

- **macOS:** w Finderze kliknij folder prawym przyciskiem → *Usługi* → *Nowy terminal w folderze*. Możesz też otworzyć Terminal, wpisać `cd ` (ze spacją) i przeciągnąć folder do okna.
- **Windows, opcja A:** otwórz folder w Eksploratorze, kliknij w pasek adresu, wpisz `powershell` i naciśnij Enter.
- **Windows, opcja B:** jesteś już w folderze, jeśli wykonałeś `cd PaintsLib` w oknie Ubuntu.

Sprawdź, czy jesteś we właściwym miejscu: komenda `ls` powinna pokazać m.in. `docker-compose.yml`.

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
| Uruchomić ponownie | `docker compose up -d` (opcja B na Macu: najpierw `colima start`) |
| Zobaczyć logi (gdy coś nie działa) | `docker compose logs -f` (wyjście: Ctrl+C) |
| Zaktualizować po zmianach w kodzie | pobierz nowy ZIP albo `git pull` (jeśli używasz gita), potem `docker compose up -d --build` |

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
