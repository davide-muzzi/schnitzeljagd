# Schnitzeljagd – Ionic/Angular App

An Ionic + Angular mobile web app that powers a modern _Schnitzeljagd_ (scavenger hunt). Players enter their name, grant the required permissions, and tackle a curated set of challenges (location hunt, distance walk, QR checks, charging, Wi‑Fi swap). All runs are timed, scored, stored locally, and optionally sent to an online leaderboard.

## Feature Highlights

- **Guided Challenge Flow** – Five sequential challenges with dynamic UI states, haptics, and auto-tracking for geo/distance goals.
- **Permission Funnel** – Dedicated screen to request geolocation/camera access before starting the run.
- **Scoring & Persistence** – Tracks Schnitzel (+100) and Kartoffel (‑20) points per run, stores `{ name, date, points }` locally, and exposes historic averages + podiums.
- **Device Integrations** – Uses Capacitor plugins for Geolocation, Network, Device battery info, and ML Kit barcode scanning. Falls back gracefully when features are unavailable (e.g., desktop GPS).
- **QR Validation** – Accepts three predefined QR payloads (`"First location found"`, `"Second location found"`, `"Third location found"`).
- **Online Submission** – On native builds the final score is posted to a Google Forms endpoint to back the remote leaderboard.

## Tech Stack

- [Ionic Angular 8](https://ionicframework.com/) (Angular 20) with standalone components.
- Capacitor 8 plugins: Geolocation, Camera, Device, Network, Preferences, Haptics, ML Kit Barcode, etc.
- Local storage via Capacitor Preferences.
- Styling with SCSS per page.

## Prerequisites

- Node.js 20+ and npm 10+
- Android Studio / Xcode (for native builds)
- Capacitor CLI (`npm install -g @capacitor/cli`) optional but recommended

## Getting Started

```bash
cd schnitzeljagd/Schnitzeljagd
npm install
```

### Run in the browser

```bash
npm start          # ng serve, defaults to http://localhost:4200
```

> Browser builds simulate device APIs; some features (QR scan, charging detection) require HTTPS or a real device to behave realistically.

### Run on Android/iOS

```bash
npx cap sync       # copies web assets + updates native projects
npx cap run android   # or: npx cap run ios
```

You can also open the native project directly (`npx cap open android` / `ios`) and run it from Android Studio or Xcode.

### Production build

```bash
npm run build      # outputs to dist/
```

## QR Codes & Challenge Details

- QR challenge succeeds only when the scanned barcode text equals one of:
  - `First location found`
  - `Second location found`
  - `Third location found`
- Geo challenges generate random targets once the challenge page loads. Location lookup only starts on that screen, so navigating there may take a second while GPS resolves.
- Charging/Wi‑Fi challenges poll platform APIs and show live status messages (e.g., “Ladezustand wird geprüft…”).

## Leaderboard & Persistence

- Every completed run is stored locally (via Capacitor Preferences) and drives the home “Top Jäger” preview plus the leaderboard podium/history/average.
- On native builds a Google Forms POST is triggered with name, Schnitzel count, Kartoffel count, and duration. Desktop dev builds skip this to avoid CORS warnings.

## Project Structure

- `src/app/` – Angular pages, components, services, and models.
- `src/app/services/game.ts` – Core game state machine (run lifecycle, scoring, online submission).
- `src/app/challenge/` – Challenge UI + logic for each task type.
- `src/app/home/` & `src/app/leaderboard/` – Entry + results overviews with storage-backed data.
- `android/` – Capacitor Android project (generated).

## Troubleshooting Tips

- **Permissions hang on native builds** – The challenge page intentionally waits for GPS when it loads; ensure you have a clear sky view or use mocked locations.
- **QR scan fails instantly** – Ensure the barcode content matches one of the three allowed strings exactly (case sensitive).
- **Online submission blocked during dev** – This is expected on `localhost` due to Google Forms CORS; test on a native build if needed.

Enjoy the hunt! 🎯
