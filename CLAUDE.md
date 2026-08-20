# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

AI Trip Planner: a full-stack app where users describe a trip (destination, dates, interests, budget) and Claude generates a day-by-day itinerary grounded in live web search, which the user can then edit directly or refine through chat. Monorepo with two independent projects:

```
ai-trip-planner/
├── backend/    # Node.js + Express + TypeScript + Prisma (PostgreSQL)
└── frontend/   # Next.js (App Router) + TypeScript + Tailwind
```

There is no root-level `package.json` — always `cd backend` or `cd frontend` before running npm commands.

## Commands

### Backend (`backend/`)

```bash
npm run dev              # tsx watch, http://localhost:4000
npm run build             # tsc -p tsconfig.json
npx tsc --noEmit           # type-check without emitting (no separate lint script exists)
npm test                   # vitest run — full suite
npx vitest run src/services/anthropic.service.test.ts   # single test file
npm run test:watch
npm run test:coverage
npx prisma migrate dev --name <name>   # after editing prisma/schema.prisma
npx prisma generate                     # regenerate client types only (no DB needed)
npx prisma studio                       # DB admin UI
npm run prewarm:destinations            # populate DestinationResearch cache for a fixed list of popular destinations (needs DATABASE_URL + ANTHROPIC_API_KEY; not run in tests)
```

Backend tests require **no live services** — Prisma and `@anthropic-ai/sdk` are mocked in every test (see `vitest.setup.ts`, which stubs required env vars so `config/env.ts` doesn't throw on import). Never write a backend test that needs a real `DATABASE_URL` or `ANTHROPIC_API_KEY`.

### Frontend (`frontend/`)

```bash
npm run dev        # http://localhost:3000
npm run build
npm run lint
npm test                                        # vitest run
npx vitest run src/components/PlannerForm.test.tsx   # single test file
npm run test:watch
```

## Architecture

### Backend request flow

`src/app.ts` builds and exports the Express `app` (routes, CORS, JSON body parsing, `errorHandler`) via `createApp()`; `src/index.ts` only calls `app.listen()`. This split exists specifically so tests can drive the app with `supertest` without binding a real port — don't collapse them back together.

Routes (`src/routes/*.routes.ts`) → controllers (`src/controllers/*.controller.ts`) → services (`src/services/*.service.ts`) → Prisma (`src/db/prisma.ts`). `requireAuth` (`src/middleware/auth.ts`) verifies the JWT and populates `req.user`; every trip/item mutation in `trips.controller.ts` additionally checks resource ownership against `req.user.userId` before touching the row (the Prisma queries themselves are not always `userId`-scoped, so this application-level check is load-bearing — don't remove it while "simplifying" a query; see `assertItemOwnership` for the itinerary-item case).

`requireAuth` only verifies the JWT signature, not whether that `userId` still exists in the DB — a token from a reset/reseeded DB can outlive the account it names. `errorHandler` (`src/middleware/errorHandler.ts`) specifically catches Prisma's `P2003` (foreign key violation, which any such stale-token request eventually triggers) and maps it to a 401 with a "log in again" message instead of a raw 500. The frontend's `request()` helper (`src/lib/api.ts`) clears `localStorage` and redirects to `/login` on any 401 response, so this pairing is what turns a stale token into a clean re-login rather than a crash.

### AI integration (`src/services/anthropic.service.ts`)

This is the most complex and highest-value part of the backend. Key pieces:

- **Structured output over free text**: prompts require Claude to return a single JSON object matching `ITINERARY_JSON_SHAPE`, parsed defensively via `extractJson`/`extractJsonArray` (strip markdown fences, slice between the first `{`/`[` and last `}`/`]`).
- **`createJsonMessage()`**: a shared retry loop (up to 3 attempts) that re-sends the model's broken/incomplete reply and asks for a correction when parsing fails. Extract callbacks must actively validate required fields (e.g. `generateItinerary` throws if `destination`/`days` are missing, `chatRefine` throws if `reply` is missing) — syntactically valid JSON that's missing a field will NOT throw on its own, so the extract callback is the only thing that catches it. This class of bug has shipped before; when adding a new AI-returning-JSON function, always validate the fields you actually need before returning.
- **`webSearchTool(maxUses)`**: per-call-site search budgets, not one shared constant — `RESEARCH_SEARCH_BUDGET` (5), `ITINERARY_SEARCH_BUDGET` (4), `CHAT_SEARCH_BUDGET` (3), `QUICK_ANSWER_SEARCH_BUDGET` (3). Keep these low; they were deliberately cut down from a single `max_uses: 8` after generation latency became a problem. `ITINERARY_SEARCH_BUDGET` was raised from 2 to 4 to leave room for opportunistic per-item `imageUrl` lookups (see below) alongside the existing date-specific checks — the prompt still forbids spending a search purely to hunt for an image.
- **Destination research caching** (`src/services/destinationResearch.service.ts`, `DestinationResearch` Prisma model): a lightweight RAG-style pattern. `getDestinationResearch(destination, locale)` looks up a cached note keyed by normalized destination + locale (14-day TTL); on a miss it calls `researchDestination()` (the one function with a large, 5-use search budget) and upserts the result. `generateItinerary` and `chatRefine` consume this cached note via the prompt instead of re-searching general destination facts on every call — their own search budgets are reserved for date-specific lookups (this week's weather, an event landing on the exact travel dates) that the cache can't cover. `npm run prewarm:destinations` (`src/scripts/prewarmDestinationResearch.ts`) pre-populates this cache for a fixed list of popular destinations x both locales, so the first real user request for one of them hits the cache instead of paying for a live research call.
- **Model tiering**: `suggestInterests` and `quickSuggestions` run on `env.anthropicFastModel` (`claude-haiku-4-5` by default) since they're low-stakes/short-output calls; `generateItinerary`/`chatRefine`/`quickAnswer` use `env.anthropicModel` (`claude-sonnet-5`). Don't pass `temperature` to `messages.create()` — it's rejected on some configured models.
- **`chatRefine()`** classifies the user's chat message as a question (`isChangeRequest: false`, just answer) or a change request (`isChangeRequest: true`, propose a full `updatedItinerary`). The frontend requires explicit user confirmation before a change is applied — see `POST /api/ai/chat/apply` — so a proposal from `chatRefine` must never be persisted directly by the `chat` controller. When only part of the itinerary changes, the prompt tells Claude to carry over each unchanged item's existing `imageUrl` as-is and only search for a new one on items it added or replaced.
- **Per-item `imageUrl`**: `ITINERARY_JSON_SHAPE` has Claude return an optional `imageUrl` (a direct image URL surfaced by `web_search`, or `null` if none was found — the prompt explicitly forbids inventing one) per itinerary item, persisted on `ItineraryItem.imageUrl` (nullable, migration `20260728050459_init`). There's no server-side validation that the URL actually resolves to an image; the frontend hides a broken one via `<img onError>` (`ItineraryView.tsx`) rather than the backend filtering it.
- **`suggestInterests(destination, locale, travelDates?)`**: optionally takes `{ arrivalDate, departureDate }` (both ISO date strings, either or both) and, when present, tells the model to only suggest season-specific activities (cherry blossoms, skiing, whale watching, etc.) that would actually be in season on those dates — leaving them out entirely rather than suggesting something the traveler can't do on this trip. `POST /api/ai/suggest-interests` accepts the same two optional fields (`ai.controller.ts`).

### Frontend structure

Two Context providers wrap the app (`src/app/layout.tsx`): `AuthContext` (JWT in `localStorage`, exposes `login`/`register`/`logout`) and `LocaleContext` (`en`/`zh` dictionaries in `src/lib/i18n/*.json`, `t()` accessor via `useLocale()`). `src/lib/api.ts` is a thin `fetch` wrapper that auto-attaches the `Authorization` header and normalizes non-2xx responses into a thrown `ApiError`; its `request()` function also clears `localStorage` and hard-redirects to `/login` on any 401 (see the `errorHandler`/`P2003` note above — this is what makes a stale token recoverable instead of a dead end).

The planner screen (`src/app/page.tsx`) only renders `PlannerForm` (→ `POST /api/ai/generate`) and `AiSuggestions`; it no longer renders the itinerary or chat inline. `PlannerForm` also debounces calls to `POST /api/ai/suggest-interests`, re-firing whenever `destination`, `arrivalDate`, or `departureDate` changes (not just destination) so date-dependent suggestions (e.g. seasonal tags) stay in sync; it then drops any previously-selected interest that's no longer in the new suggestion list rather than clearing selections outright. On a successful generate it stores the response's `feasibilityNotes` in `sessionStorage` via `storeFeasibilityNotes()` (`src/lib/tripSessionState.ts` — feasibility notes aren't persisted on the `Trip` row, so this is how they survive the redirect) and pushes to `/trips/[id]?new=1`. `src/app/trips/[id]/page.tsx` reads that trip (`GET /trips/:id`), consumes the stashed feasibility notes when `?new=1` is present, and renders `ItineraryView` (checkbox/edit/delete per item, PATCH/DELETE against `trips.controller.ts`) and `ChatPanel` (conversational edits, with the propose/confirm/apply flow described above) side by side. Its "Back" button behaves differently depending on how the trip was reached: for a freshly-generated trip (`?new=1`) it opens a save/discard confirm modal (confirming just navigates away since the trip is already persisted; discarding calls `DELETE /trips/:id`); for a trip opened normally from `/trips` it navigates back directly with no modal.

`ItineraryView` renders each item's AI-supplied `imageUrl` (thumbnail, hidden via `onError` if the URL 404s/fails to load) plus a "view on map" link built client-side by `googleMapsUrl()` — a plain Google Maps search URL from `item.location` (falling back to `item.title`), not an AI-returned field or a Maps API call.

`AiSuggestions` is a separate destination-aware quick-question panel on the planner screen (`quick-suggestions` → click → `quick-answer`), independent of the main chat. Its answer state is a `Record<question, AnswerState>` keyed by question text rather than one shared slot — this is deliberate: a single shared "current answer" slot let switching between suggestions (or reopening one mid-request) corrupt or lose another suggestion's answer. Per-question state also means a suggestion already `loading`/`done` is never re-fetched, only one in an `error` state is retried.

All AI-facing endpoints take a `locale` param and expect Claude to respond in that language — when adding a new AI call, thread `locale` through the same way existing ones do.

## Environment variables

Backend (`backend/.env`, see `.env.example`): `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-5`), `ANTHROPIC_FAST_MODEL` (default `claude-haiku-4-5`), `PORT`, `CORS_ORIGIN`. Frontend (`frontend/.env.local`, see `.env.local.example`): `NEXT_PUBLIC_API_URL`.

## Subagents

`.claude/agents/` defines two project-scoped subagents — prefer delegating to them over doing the work inline:

- **`tester`**: adds/maintains backend (Vitest + Supertest) and frontend (Vitest + Testing Library) test coverage. Knows the mock-only constraint and which logic in this repo is worth testing.
- **`writer`**: maintains `TUTORIAL.md` (personal, gitignored learning notes — never commit this file), `README.md` (the public-facing architecture/feature overview committed to the repo; never link `TUTORIAL.md` from it, since it isn't in the repo), and this file (`CLAUDE.md`) itself.
