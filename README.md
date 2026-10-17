# GuiltFree

Track your Swiggy orders against a weekly and monthly budget of **orders, rupees and calories**, without any Swiggy API.
Swiggy emails you a bill when an order is delivered; GuiltFree reads those emails, parses them, estimates the
calories with an open-weight model (Gemma), and tells you how much budget is left.

> **Status: hackathon MVP.** It tracks and warns. It does **not** block the Swiggy app yet; see [Roadmap](#roadmap).

## How it works

```
Gmail (read-only OAuth) ──► server ──► MongoDB
   Swiggy "delivered" email    │  1. rules parser (cheerio), bill must add up to the total
                               │  2. open-weight LLM fallback for layouts the parser doesn't know
                               │  3. calorie estimate per dish (LLM, cached)
                               └─ 4. budget rules engine (IST weeks/months) ──► React Native app
```

- Only orders delivered **after you start tracking** are counted (`trackingSince`); no history is imported.
- The model only ever sees **dish names** (calories) or the **bill table text** (fallback). Names, addresses and
  raw emails are never sent to it or stored.
- The ledger is keyed by Swiggy order id, so syncing twice never double-counts.
- Calories are **estimates**. Without a configured model the server uses clearly-labelled placeholder values.

## Layout

| Path | What |
|---|---|
| `apps/server` | Express + TypeScript API, Gmail source, parser, LLM client, Mongo/in-memory stores |
| `apps/mobile` | Expo (React Native) Android app |
| `packages/shared` | zod schemas, API types and the budget rules engine, used by both |
| `fixtures/emails` | One real Swiggy email (name and address redacted) plus synthetic variants |
| `scripts` | `make-fixtures.mjs` (regenerate fixtures from a raw `.eml`), `check-secrets.mjs` |

## Quick start (no accounts needed)

```bash
npm install
cp .env.example .env        # defaults: mock Gmail, mock calories, in-memory store
npm run dev:server          # http://localhost:3000
npm run dev:mobile          # Expo; press "a" to open the Android emulator
npm test                    # 47 tests
```

In mock mode the server serves the fixture emails as if they were in a mailbox, so the app has data immediately.
Setting up the emulator, Gmail OAuth, MongoDB Atlas and OpenRouter is in [docs/SETUP.md](docs/SETUP.md).

## Configuration

All configuration is environment variables; see [`.env.example`](.env.example). **Never commit `.env`**: it is
git-ignored, and `npm run check:secrets` scans tracked files for common credential patterns.

| Switch | Mock (default) | Real |
|---|---|---|
| `GMAIL_MODE` | `mock` reads `fixtures/emails` | `google` uses the Gmail API |
| `LLM_API_KEY` | empty → placeholder calories | any OpenAI-compatible endpoint serving Gemma |
| `MONGODB_URI` | empty → in-memory store | MongoDB Atlas |

## API

All routes except `/health` and `/auth/*` need an `x-api-key` header.

| Route | |
|---|---|
| `GET /status` | limits, usage per metric, `limitReached`, connection and sync state |
| `GET /orders` | recent orders, newest first |
| `PUT /settings` | replace weekly and/or monthly limits |
| `POST /sync` | check Gmail now |
| `GET /auth/google/start` | begin Gmail OAuth (open in a browser on the server machine) |

## Limitations

- The email arrives **when the order is delivered**, so the ledger lags by the delivery time. This is also why
  a blocker could only ever stop the *next* order, never one already in flight.
- Single user, one shared API key. Fine for a demo, not for production.
- Parsing is verified against one real email layout. Multi-restaurant orders use a different layout and go
  through the LLM fallback, which is untested against real emails.

## Roadmap

- **Blocker:** an Android `AccessibilityService` that shows a "limit reached" screen when Swiggy opens. React
  Native cannot detect the foreground app, so this needs a small native module and a development build instead
  of Expo Go (`npx expo prebuild`). The app is kept compatible with that move: no `android/` folder is committed
  and only config-plugin-friendly libraries are used.
- On-device or self-hosted Gemma so no email-derived text leaves the user's infrastructure.
