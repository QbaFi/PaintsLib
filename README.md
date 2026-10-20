# PaintsLib

A self-hosted app for keeping track of your miniature paints (Warhammer and other miniatures).

- **Catalog** of ~2,700 paints: Citadel, Vallejo (Game Color, Xpress Color, Model Color), The Army Painter, AK Interactive, Green Stuff World
- **My collection**: quantity, status (full / running low / empty / to buy), tags
- the **closest equivalent** of every paint from a brand of your choice (Citadel by default), with a ΔE similarity score
- **search by colour** (colour picker), **shopping list** with CSV export
- add your own paints that aren't in the catalog
- **import your collection from a spreadsheet** (Google Sheets / Excel → CSV) with a preview before anything is saved; a template is available in *Settings*
- interface in **English and Polish** (EN/PL switch in the top-right corner)

Everything runs in Docker. You don't need Python or Node.js on your computer.

**Pick one of two ways to run Docker:**

| | Option A: Docker Desktop | Option B: terminal only |
|---|---|---|
| Best for | you prefer clicking and want to see containers in a window | you're fine typing a few commands |
| Installation | download the app from Docker's website | a few terminal commands |
| Disk space | larger (app + virtual machine) | smaller (just the Docker engine) |
| Licence | free for personal use | fully open source |

From step 3 ("Start the app") both options work the same way, because the `docker compose …` commands are identical.

---

## 1A. Option A: install Docker Desktop (one time)

**macOS**
1. Download Docker Desktop: https://www.docker.com/products/docker-desktop/. Choose **Apple Silicon** (Macs with an M1/M2/M3/M4 chip) or **Intel**. You can check which one you have under  → *About This Mac*.
2. Open the downloaded `.dmg` file and drag Docker into *Applications*.
3. Launch Docker Desktop and wait until the whale icon in the menu bar stops animating.

**Windows**
1. Download Docker Desktop from the same page and run the installer.
2. When the installer asks about **WSL 2**, leave it ticked. You may need to restart your computer afterwards.
3. Launch Docker Desktop and wait until *Engine running* appears at the bottom of the window.

> Docker needs several GB of free disk space. Ideally keep at least 10 GB free.

Then continue with step **2. Get the project**.

## 1B. Option B: Docker from the terminal only (one time)

### macOS: Homebrew + Colima

Colima is a lightweight, free Docker engine for the Mac, without a windowed app.

1. Open **Terminal** (Cmd + Space, type "Terminal").
2. Install **Homebrew**, the package manager for macOS. Skip this if you already have it. Paste:
   ```
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   The installer asks for your Mac password (nothing appears while you type, that's normal) and may install Apple's *Command Line Tools*. At the end it prints commands under **"Next steps"**. Copy and run them so the terminal can find the `brew` command.
3. Install Docker, Docker Compose and Colima:
   ```
   brew install docker docker-compose colima
   ```
4. Tell Docker where Compose lives (one time):
   ```
   mkdir -p ~/.docker && echo '{"cliPluginsExtraDirs": ["'"$(brew --prefix)"'/lib/docker/cli-plugins"]}' > ~/.docker/config.json
   ```
5. Start the Docker engine:
   ```
   colima start
   ```
6. Check that it works: `docker compose version` should print a version number.

> **After every Mac restart**, run `colima start` first. To stop the engine and free up memory: `colima stop`.

### Windows: WSL (Ubuntu) + Docker Engine

On Windows, Docker runs inside **WSL**, the Linux environment built into Windows. All later commands are typed in the **Ubuntu** window.

1. Click Start, type `PowerShell`, right-click it → **Run as administrator**.
2. Install WSL with Ubuntu:
   ```
   wsl --install
   ```
   Restart your computer when Windows asks you to.
3. After the restart an **Ubuntu** window opens (or launch it from the Start menu). Choose a Linux username and password; they can differ from your Windows ones. Nothing appears while you type the password, that's normal.
4. In the Ubuntu window, install Docker:
   ```
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER
   ```
5. Close the Ubuntu window and open it again so the permission change takes effect.
6. Check that it works: `docker compose version` should print a version number.
   If you see *Cannot connect to the Docker daemon*, run `sudo service docker start`.

> With option B on Windows, **get the project and run every command in the Ubuntu window**, not in PowerShell (see step 2).

## 2. Get the project

**With git** (recommended, makes updating easy):
```
git clone https://github.com/QbaFi/PaintsLib.git
cd PaintsLib
```
On Windows with option B, run this in the Ubuntu window (git is already installed there). On a Mac, git comes with Apple's Command Line Tools: run `xcode-select --install` if the `git` command is missing.

**Without git:** on the repository page click the green **Code → Download ZIP** button and unzip the file, e.g. into `Documents/PaintsLib`.

## 3. Start the app

Open a terminal **in the project folder**:

- **macOS:** in Finder, right-click the folder → *Services* → *New Terminal at Folder*. Or open Terminal, type `cd ` (with a space) and drag the folder into the window.
- **Windows, option A:** open the folder in File Explorer, click the address bar, type `powershell` and press Enter.
- **Windows, option B:** you're already in the folder if you ran `cd PaintsLib` in the Ubuntu window.

Check you're in the right place: the `ls` command should list `docker-compose.yml`, among others.

Run:

```
docker compose up -d --build
```

The first start takes a few minutes while Docker builds the app image. Later starts are quick.

Open in your browser: **http://localhost:8080**

On first start the app downloads the paint catalog by itself, which takes a few seconds. If the catalog is empty, refresh the page after a moment.

## Everyday use

| What you want to do | Command (in the project folder) |
|---|---|
| Stop the app | `docker compose down` |
| Start it again | `docker compose up -d` (option B on a Mac: run `colima start` first) |
| See the logs (when something is wrong) | `docker compose logs -f` (exit with Ctrl+C) |
| Update to the latest version | `git pull` (or download a new ZIP), then `docker compose up -d --build` |

`git pull` only updates the files; `docker compose up -d --build` is what rebuilds the app from them. Restarting the container in Docker Desktop does **not** pick up new code.

Your data (collection, settings) lives in the Docker volume `paintslib-data`. It **survives** stopping, updating and rebuilding the app. Only `docker compose down -v` would delete it, so **don't use `-v`** unless you want to start from scratch.

### Backup

```
docker compose stop
docker compose cp app:/data/paintrack.db ./paintrack-backup.db
docker compose start
```

Restore:

```
docker compose stop
docker compose cp ./paintrack-backup.db app:/data/paintrack.db
docker compose start
```

For a quick copy of just your collection, open `http://localhost:8080/api/inventory/export.csv`.

### Importing your collection from a spreadsheet

In the app: *Settings → Import your collection from a spreadsheet (CSV)*.

1. Click **Download CSV template**, open it in Google Sheets or Excel and fill in your paints. You can also use your own sheet with the columns `Brand`, `Series`, `Colour`, `Conversion` (optionally `Quantity`, `Status`; Polish column names work too: `Marka`, `Seria`, `Kolor`, `Odpowiednik`, `Ilość`, `Stan`).
2. In Google Sheets: *File → Download → Comma-separated values (.csv)*.
3. Choose the file in the app. You first get a **preview**: what was found in the catalog, what was matched approximately (e.g. a typo) and what's missing. Nothing is saved until you click **Import**.

The `Conversion` column holds your own equivalents; separate several with `/`. They're saved as **confirmed** and take priority over automatic colour matching. Importing the same file again doesn't create duplicates.

> After updating the app, click **Import / update catalog** in *Settings* to pull in new paint ranges.

### Configuration (optional)

Copy `.env.example` to `.env` and change the values, e.g. the port, or import every brand from the source (~10,000 paints). Then run `docker compose up -d`.

By default the app is reachable **from this computer only**. To open it from, say, your phone on the same Wi-Fi, change `"127.0.0.1:${PORT:-8080}:8000"` to `"${PORT:-8080}:8000"` in `docker-compose.yml`. There is no login, so only do this on a trusted home network.

---

## How it works

```
PaintsLib/
├── Dockerfile            # builds the frontend (Node), then the Python image
├── docker-compose.yml    # a single "app" service + a volume for the database
├── backend/              # FastAPI + SQLAlchemy + SQLite
│   ├── app/
│   │   ├── main.py               # app start-up, serves the frontend
│   │   ├── routers/              # API endpoints (/api/paints, /api/inventory, /api/settings…)
│   │   ├── color.py              # sRGB → Lab, CIEDE2000 colour difference
│   │   ├── matching.py           # finding the closest paints
│   │   ├── catalog.py            # which brands/ranges to import and how to tell paint types apart
│   │   ├── importer.py           # catalog import from miniature-paints
│   │   └── collection_import.py  # CSV collection import (matching rules)
│   ├── alembic/          # database migrations
│   └── tests/
└── frontend/             # React + TypeScript + Vite + Tailwind
    └── src/
        ├── pages/        # screens: Collection, Catalog, By colour, Shopping, Settings
        └── i18n.tsx      # English and Polish texts
```

- **Colour matching:** colours are converted to the CIE Lab colour space and compared with the **CIEDE2000** formula, which follows human perception much better than a plain RGB difference. ΔE below 2 is near identical, 2–5 close, 5–10 similar. Washes, contrast paints and opaque paints are only compared within their own group.
- **API documentation** is available at http://localhost:8080/docs while the app is running.
- **Automated tests** run on GitHub for every change (the *Actions* tab).

### Working on the code without Docker (optional)

Requires Python 3.12 and Node.js 22.

```
# backend
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
export DATABASE_URL=sqlite:///./dev.db               # Windows: $env:DATABASE_URL="sqlite:///./dev.db"
alembic upgrade head
uvicorn app.main:app --reload
pytest

# frontend (in a second terminal)
cd frontend
npm install
npm run dev     # http://localhost:5173
```

---

## Credits and disclaimer

- Paint data comes from [Arcturus5404/miniature-paints](https://github.com/Arcturus5404/miniature-paints) (MIT licence, © Rick Fleuren), downloaded when the app runs. The colour values are approximations taken from photos and swatches, not measurements.
- PaintsLib is an independent fan project. It is not affiliated with, endorsed by or sponsored by Games Workshop, Acrylicos Vallejo, The Army Painter, AK Interactive or Green Stuff World. Citadel and all other brand and paint names are trademarks of their respective owners and are used only to identify the products.
