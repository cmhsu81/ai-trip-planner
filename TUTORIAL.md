# AI Trip Planner — A Progressive Tutorial from Zero

This tutorial walks you through building this project from an empty folder: a user enters the number of days, a destination, and preferences; AI (Claude) searches the web for up-to-date attractions, restaurant reviews, and news/weather information, and lays out a full itinerary. The user can check off items, delete them, edit them, or ask the AI to revise the plan through a chat dialog. Everything is saved to a database, and the UI supports switching between Chinese and English.

Key resume-worthy technologies covered: **Next.js + TypeScript (frontend), Node.js + Express + TypeScript (backend), PostgreSQL + Prisma ORM (database), JWT authentication, Claude API tool use / web search (LLM integration and prompt engineering)**.

> The code currently in this repo is already the finished result of following this tutorial. You can read the code alongside the tutorial, or delete it and rebuild it by hand to reinforce what you've learned — the latter is better preparation for being able to explain every decision clearly in an interview.

---

## Phase 0: Prerequisites

1. **Install Node.js 20+**: confirm with `node -v`.
2. **Get an Anthropic API key**: sign up at https://console.anthropic.com/ and create an API key (the Claude API is pay-as-you-go, and the `web_search` tool this project uses is billed separately, at $10 per 1000 searches plus token costs — spend during development is small, but it's worth setting a usage cap).
3. **Sign up for a free cloud PostgreSQL instance**: [Neon](https://neon.tech) is recommended (or [Supabase](https://supabase.com)). After signing up, create a new project and you'll get a connection string that looks like:
   ```
   postgresql://USER:PASSWORD@HOST/dbname?sslmode=require
   ```
   Copy it somewhere — the backend will need it shortly. This step requires no local Docker or PostgreSQL server install at all.
4. **A GitHub account + an empty repository** (e.g. `ai-trip-planner`).
5. VS Code is recommended as an editor.

---

## Phase 1: Project Skeleton and Folder Structure

This is a **monorepo** (two independent frontend/backend projects living in one repo), because the frontend is Next.js and the backend is a standalone Node.js/Express server:

```
ai-trip-planner/
├── backend/     # Node.js + Express + TypeScript + Prisma
├── frontend/    # Next.js + TypeScript + Tailwind
├── README.md
└── TUTORIAL.md
```

```bash
mkdir ai-trip-planner && cd ai-trip-planner
git init
mkdir backend frontend
```

---

## Phase 2: Backend — Initialization and Setup

### 2.1 Initialize the npm project

```bash
cd backend
npm init -y
```

### 2.2 Install dependencies

```bash
npm install express cors dotenv bcryptjs jsonwebtoken zod @prisma/client @anthropic-ai/sdk
npm install -D typescript tsx prisma @types/node @types/express @types/cors @types/bcryptjs @types/jsonwebtoken
```

- `express`: the HTTP server framework
- `zod`: request body validation (keeps dirty data out of the database — a very common backend practice)
- `bcryptjs` / `jsonwebtoken`: password hashing and login JWTs
- `@prisma/client` + `prisma`: a TypeScript ORM that turns your tables into a type-safe API
- `@anthropic-ai/sdk`: the official SDK for calling the Claude API
- `tsx`: run TypeScript directly during development without a separate compile step

### 2.3 `tsconfig.json`

Create `backend/tsconfig.json` with `strict: true` (a good habit for writing rigorous TypeScript, and a resume plus), `rootDir: src`, and `outDir: dist`.

### 2.4 Environment variables

Create `backend/.env.example` (committed to git, as a template) and `backend/.env` (**not** committed — already excluded by `.gitignore`):

```
PORT=4000
CORS_ORIGIN=http://localhost:3000
DATABASE_URL=postgresql://...your Neon connection string...
JWT_SECRET=a long random string
JWT_EXPIRES_IN=7d
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-5
ANTHROPIC_FAST_MODEL=claude-haiku-4-5
```

`src/config/env.ts` reads and validates all of these variables in one place, and the rest of the code pulls config from there rather than scattering `process.env.XXX` everywhere — so a missing variable fails loudly at startup instead of blowing up on some random request later. `ANTHROPIC_FAST_MODEL` wasn't added until Phase 18: it routes lightweight calls (interest suggestions, quick-question buttons) to a cheaper model, and was only introduced later during a cost-optimization pass — see Phase 18.3.

---

## Phase 3: Database Schema (Prisma)

`backend/prisma/schema.prisma` defines 5 tables:

- **User**: email + hashed password
- **Trip**: a single trip (destination, number of days, preferences, AI-generated summary)
- **ItineraryDay**: which day of the trip an item belongs to
- **ItineraryItem**: a single item within a day (attraction/restaurant/activity/transport/lodging), with a `confirmed` field that maps to "user has checked this off"
- **ChatMessage**: chat history, so that "adjust the itinerary via chat" has continuity across turns

Relationship design: `User 1—N Trip 1—N ItineraryDay 1—N ItineraryItem`, and `Trip 1—N ChatMessage`. This kind of one-to-many relationship plus cascade delete (deleting a Trip automatically deletes its days/items) is relational database design 101 — good resume material: "designed a normalized relational database schema."

After filling in `DATABASE_URL` in `.env`, run:

```bash
npx prisma migrate dev --name init
```

This command:
1. Connects to the Neon database
2. Generates a SQL migration file (records the history of schema changes — every future schema change leaves a versioned trail)
3. Actually creates the tables in the database
4. Generates a type-safe Prisma Client (the `prisma` object exported from `src/db/prisma.ts`)

You can run `npx prisma studio` to open a web-based database admin UI, which is great for demos.

---

## Phase 4: Backend — Authentication (JWT)

- `src/utils/jwt.ts`: signs/verifies JWTs
- `src/middleware/auth.ts`: `requireAuth` middleware that checks the `Authorization: Bearer <token>` header, and on success populates `req.user` so downstream controllers know who's calling
- `src/controllers/auth.controller.ts` + `src/routes/auth.routes.ts`:
  - `POST /api/auth/register`: hashes the password with `bcrypt.hash` before storing it, and returns a JWT
  - `POST /api/auth/login`: verifies the password with `bcrypt.compare` and returns a JWT

The frontend stores the JWT it receives in `localStorage`, and attaches it via the `Authorization` header on every subsequent call to a protected API. This is the simplest authentication approach that doesn't depend on a third-party service — good resume material: "implemented stateless JWT-based authentication."

---

## Phase 5: Backend — AI Itinerary Planning Core (Key Feature)

This is the most technically substantial part of the whole project, and the best one to go deep on in a resume or interview: `src/services/anthropic.service.ts`.

### 5.1 Why use Claude's `web_search` tool instead of integrating Google Maps / TripAdvisor / Yelp APIs directly?

- Each of those three APIs requires its own key, has its own rate limits and terms of service, and adds up to a lot of integration overhead
- The Claude API's built-in `web_search` tool lets the model decide for itself when it needs to search the web (e.g. "the most popular recent attractions in this city," "news from the last couple of years," "the local weather pattern"), and automatically attaches source citations
- This lets a single set of calls cover multiple information needs — attractions/restaurant reviews, news, weather/events — which is exactly the kind of "real-time, multi-faceted information aggregation" this app needs

```ts
function webSearchTool(maxUses: number): Anthropic.Messages.WebSearchTool20250305 {
  return { type: "web_search_20250305", name: "web_search", max_uses: maxUses };
}
```

When you call `client.messages.create({ model, tools: [webSearchTool(n)], system, messages })`, Claude decides within a single API request whether to search, and how many times (`max_uses` caps it so it can't run away), and the server-side processing is done before the final text comes back to you.

> This was originally a hardcoded shared constant, `WEB_SEARCH_TOOL` with `max_uses: 8`. When destination-research caching was added in Phase 18, it was refactored into `webSearchTool(maxUses)`, a function that gives each call site a different search budget depending on context — details in Phase 18.

### 5.2 Getting the LLM to return "structured data" instead of free text

The itinerary needs to be saved to the database and rendered by the frontend as a checklist, so the AI can't just write a free-form article. The approach is to explicitly define the JSON shape in the **system prompt** (see `ITINERARY_JSON_SHAPE`) and instruct the model to "return only this JSON, no other text." The response is then defensively parsed with `extractJson()` (first look for a ```json fenced block; if none is found, fall back to the first `{` through the last `}`), so that the model adding a stray sentence here or there doesn't blow up the whole parse.

This is a core LLM engineering skill: **prompt design + output-format constraints + fault-tolerant parsing** — good resume material: "designed a structured-output prompting strategy that reliably converts LLM responses into type-safe data structures."

> A more advanced approach: this could later be swapped for Claude's [tool use / structured outputs](https://platform.claude.com/docs) to make the format stricter (replacing plain-text JSON with a "save itinerary" tool definition) — a good future resume-worthy extension.

### 5.3 Two core functions

- `generateItinerary(params)`: takes destination/days/preferences, builds a prompt, and asks Claude to research and return a full itinerary as JSON
- `chatRefine(params)`: puts the "current itinerary JSON" into the system prompt along with chat history and the user's latest message, and has Claude return `{ reply, updatedItinerary }` — this is the core of "adjust the itinerary via chat"

### 5.4 API layer

- `POST /api/ai/generate`: creates a Trip, calls `generateItinerary`, and writes the result into `ItineraryDay`/`ItineraryItem` (`replaceTripItinerary` in `itinerary.service.ts` uses `prisma.$transaction` to delete and rebuild everything as a batch, keeping the data consistent)
- `POST /api/ai/chat`: reads the current itinerary plus chat history, calls `chatRefine`, saves the new user message and AI reply into `ChatMessage`, and overwrites the database with the new itinerary

---

## Phase 6: Backend — Itinerary CRUD (Check / Delete / Edit)

`src/controllers/trips.controller.ts`:

- `GET /api/trips`: lists all of a user's trips (used by the "My Trips" page)
- `GET /api/trips/:id`: full details for a single trip
- `PATCH /api/trips/:id`: renames the trip
- `DELETE /api/trips/:id`: deletes the whole trip
- `PATCH /api/trips/:tripId/items/:itemId`: **edit a single itinerary item** — change the title/time/duration/description, or toggle `confirmed` (the frontend checkbox)
- `DELETE /api/trips/:tripId/items/:itemId`: **delete a single itinerary item**

"Swap for something else" is implemented two ways: manually editing the fields (PATCH), or clicking the "🔁 AI" button, which sends a pre-filled message into the chat box asking the AI for a better suggestion (this re-triggers `web_search`). "Extend the duration" is just editing the `estimatedDuration` field.

Every mutation first confirms the record belongs to the currently logged-in user (`assertItemOwnership`), preventing user A from editing user B's trip — this is one of the most basic backend security details, and also one of the most commonly asked-about in interviews (the difference between authorization and authentication).

---

## Phase 7: Backend — Wiring It Together & Local Testing

`createApp()` in `src/app.ts` wires together CORS, the JSON body parser, the three route groups (`/api/auth`, `/api/trips`, `/api/ai`), and a shared error handler (`errorHandler`), and exports the assembled `app`; `src/index.ts` only handles `app.listen(env.port)`. Splitting "assembling the app" from "starting the server (binding a port)" into two files was done so that the Phase 19 API integration tests could hit `app` directly with `supertest` without actually listening on a port — this small refactor was worth doing well before the tests were even written.

```bash
npm run dev
# in another terminal
curl http://localhost:4000/api/health
# should return {"status":"ok"}
```

---

## Phase 8: Frontend — Initializing Next.js

```bash
cd ../frontend
npx create-next-app@latest . --typescript --eslint --tailwind --app --src-dir --import-alias "@/*"
```

This picks the **App Router** (Next.js's current mainstream architecture), TypeScript, and Tailwind CSS (for quickly styling layouts without writing a pile of separate CSS files).

After installation the folder looks like this: `src/app` (routes), `src/components`, `src/contexts`, `src/lib`, `src/types`.

Add `frontend/.env.local.example`:
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```
Copy it to `.env.local` (git-ignored). In Next.js, only variables prefixed with `NEXT_PUBLIC_` get bundled into the frontend JS — a deliberate safety mechanism to prevent accidentally leaking backend secrets to the browser.

---

## Phase 9: Frontend — Global State (i18n + Auth State)

- `src/lib/i18n/en.json` / `zh.json`: two translation dictionaries
- `src/contexts/LocaleContext.tsx`: `LocaleProvider` provides a `t(key)` translation function, persists the chosen language to `localStorage` on switch, and remembers the user's choice across refreshes
- `src/contexts/AuthContext.tsx`: manages the logged-in user, `login`/`register`/`logout`, and stores the JWT in `localStorage`
- `src/components/LanguageSwitcher.tsx`: the Chinese/EN toggle button
- `src/app/layout.tsx`: wraps the whole app in `LocaleProvider` + `AuthProvider` and mounts the shared `Navbar`

These two Contexts are a textbook example of "you don't need Redux/Zustand for global state — React Context is enough" for a small-to-mid-size project — good resume material: "used React Context to share authentication state and locale switching across pages."

---

## Phase 10: Frontend — API Layer

`src/lib/api.ts` is a thin `fetch` wrapper: it automatically prepends `NEXT_PUBLIC_API_URL`, automatically attaches the `Authorization` header when logged in, and converts any non-2xx response into a thrown `ApiError`, so every page's `try/catch` can handle errors the same way.

---

## Phase 11: Frontend — Login / Register Pages

`src/app/login/page.tsx`, `src/app/register/page.tsx`: controlled forms + `useAuth()`, redirecting to `/trips` on success.

---

## Phase 12: Frontend — Trip Planning Main Page (Core Interaction)

`src/app/page.tsx` is the app's main screen, tying together three components:

1. **`PlannerForm`**: destination, number of days, departure date, interests, must-see attractions/restaurants, travel style, budget → on submit, calls `POST /api/ai/generate`
2. **`ItineraryView`**: renders the returned `itineraryDays` as a per-day checklist, where each item has:
   - ☑️ a checkbox (maps to `confirmed`; toggling it immediately PATCHes the backend)
   - "Edit" → switches to a form, PATCHes on save
   - "🔁 AI" → pre-fills "please swap this for something else" into the chat box
   - "Delete" → DELETE
3. **`ChatPanel`**: the chat dialog; sending a message calls `POST /api/ai/chat`, and the returned new itinerary completely overwrites `itineraryDays` on screen

This page demonstrates two coexisting ways to modify an itinerary — "AI generates → user tweaks with structured actions" and "AI regenerates via conversational actions" — and is also the most interesting interaction design in this project to walk through on a resume.

---

## Phase 13: Frontend — "My Trips" Page

- `src/app/trips/page.tsx`: lists all trips, with delete and drill-in
- `src/app/trips/[id]/page.tsx`: similar to the home page, but loads an existing trip's data instead of generating a new one from a form

---

## Phase 14: Full Local Test Run

1. Backend: `cd backend && npm run dev` (http://localhost:4000)
2. Frontend: `cd frontend && npm run dev` (http://localhost:3000)
3. Open http://localhost:3000 in a browser
4. Register an account → auto-logged in
5. Fill in destination/days → "Generate Itinerary" (the first call takes several seconds to over ten seconds, since Claude has to search the web)
6. Check off/delete/edit itinerary items, confirming the UI updates immediately and the data survives a page refresh (proving it was actually written to the database)
7. Type "swap the lunch on day 2 for something else" in the chat box to test AI adjustment
8. Toggle the Chinese/EN switch in the top right and confirm the UI text changes
9. Go to "My Trips" and confirm the trip you just created is listed

---

## Phase 15: Pushing to GitHub

```bash
cd ai-trip-planner
git add .
git status   # confirm .env / .env.local were not added
git commit -m "..."
git branch -M main
git remote add origin git@github.com:<your-account>/ai-trip-planner.git
git push -u origin main
```

**Triple-check** that `backend/.env` and `frontend/.env.local` (which contain API keys and database credentials) were never committed — this project's `.gitignore` already excludes them, but getting into the habit of glancing at `git status` before every push is good practice.

---

## Phase 16: From MVP to Product — Landing Page, Budget Slider, Date/Time, AI Interest Suggestions

After the MVP (Phases 1–15) was done, a batch of features was added to make the project feel like a real product rather than a classroom assignment — all of it part of Stage 1:

- **Landing page for logged-out users**: `src/components/LandingPage.tsx` replaces "you open the app and it's an empty form" with a marketing page that has a headline, feature copy, and CTA buttons, shown only to logged-out users — a detail many tutorial projects skip, but one an interviewer will notice immediately.
- **Budget as a slider**: `PlannerForm.tsx` uses `<input type="range">` so the user drags out `$X USD / person`, which is both nicer to use than a free-text box and produces a consistent format to feed into the AI prompt (no one typing something like "maybe around thirty thousand NTD" that's hard to parse).
- **Arrival/departure date + time**: split into two `<input type="date">` + `<input type="time">` pairs (defaulting to 10:00 / 18:00). The frontend uses `useEffect` to automatically derive the number of days from the date range (`daysAreDerived`), and blocks invalid input such as "departure date before arrival date" or "same day but departure time before arrival time" — the details of this UI validation (disabling buttons, inline error messages, auto-clearing invalidated fields) are themselves solid frontend chops to talk about on a resume.
- **AI-suggested interest tags**: as the user types a destination (debounced 600ms), a call to `POST /api/ai/suggest-interests` asks Claude to suggest 5–10 relevant interests for that place (mountain terrain suggests "hiking," "hot springs"; a coastal city suggests "seafood," "diving"), and the user clicks instead of typing — this is both more convenient than typing interest keywords and produces more structured preference data for the AI to work with.

The visuals were also fully redesigned (teal/emerald color palette, rounded cards, color-coded badges by item type). If you're demoing this in an interview, this round of changes is what turns it from "a working prototype" into "something that looks like a product."

---

## Phase 17: AI Quick-Suggestions Panel + Chat Confirmation Flow

### 17.1 Quick-suggestions panel (`AiSuggestions.tsx`)

Beyond letting users type their own questions into the chat box, this adds a layer of "guess what you want to ask": after generating an itinerary, `POST /api/ai/quick-suggestions` has Claude generate 5 quick-question buttons for that destination (e.g. "nearby cities," "local etiquette," "packing tips"). Clicking one triggers `POST /api/ai/quick-answer`, which runs the actual query (using `web_search`), with the answer shown in a modal so it doesn't take up space in the itinerary view. This is a classic design trade-off: "reduce how much typing the user has to do, without sacrificing the depth of the answer."

### 17.2 Classifying chat messages: question vs. change request

A plain chatbot has a problem: if a user says "any dessert shops nearby you'd recommend?" and the AI treats its answer as an itinerary change and applies it, that's confusing. The system prompt in `chatRefine()` has Claude first classify the message as one of:

- **(a) A question**: just answer it, `isChangeRequest: false`, leave the itinerary untouched
- **(b) A change request**: propose an updated full itinerary as JSON, as a **proposal**, `isChangeRequest: true`

The frontend only shows a "Yes, apply / No, keep as is" confirmation (`ChatPanel.tsx`) when it receives `isChangeRequest: true`; only clicking "Yes" calls the separate `POST /api/ai/chat/apply` endpoint to write the proposal to the database. **Proposing** a change and **applying** a change are deliberately split into two APIs and two steps — this "propose first, confirm second" pattern is a common design principle for keeping an AI agent's automated behavior under the user's control — good resume material: "designed a human-confirmation step for AI-proposed changes to prevent irreversible mistakes."

---

## Phase 18: Performance and Cost Optimization — Destination-Research Caching (A Simplified RAG Concept)

At this stage the project ran into a very real problem: **generating a single itinerary took 2–3 minutes**, and every generation cost token money. The root cause was that `generateItinerary()` let Claude decide on its own whether to use the `web_search` tool, with the cap set to `max_uses: 8` — meaning that in the worst case, a single generation could run 8 rounds of "search → read results → decide whether to search again," each round being a real web search, which is slow and also costs $10 per 1000 searches on top of token spend.

### 18.1 Observation: most search content is actually repetitive

For the same destination (say, "Tokyo"), regardless of who generates a trip or when, the answers to "what are the popular attractions," "what restaurants are recommended," and "what's the general weather pattern like" barely change. The only thing that genuinely needs a real-time lookup is information tied to **this specific trip's exact dates** (the forecast for those particular days, events that happen to fall in that window). The original design mixed both kinds of needs into the same `web_search` call, which meant re-searching unchanging information every single time.

### 18.2 Approach: split into "research" and "generation" layers, with a cache in between

A new table, `DestinationResearch` (`backend/prisma/schema.prisma`), keyed on "destination + locale," stores a reusable set of notes about a destination:

```prisma
model DestinationResearch {
  id          String   @id @default(uuid())
  destination String
  locale      String
  content     String
  updatedAt   DateTime @updatedAt
  createdAt   DateTime @default(now())

  @@unique([destination, locale])
}
```

Paired with `backend/src/services/destinationResearch.service.ts`:

```ts
export async function getDestinationResearch(destination: string, locale: Locale): Promise<string> {
  const key = normalizeDestination(destination); // trim + lowercase, so "Tokyo" / " tokyo " share a cache row

  const cached = await prisma.destinationResearch.findUnique({
    where: { destination_locale: { destination: key, locale } },
  });

  if (cached && Date.now() - cached.updatedAt.getTime() < CACHE_TTL_MS) {
    return cached.content;   // cache hit: no need to search again at all
  }

  const content = await researchDestination(destination, locale); // cache miss: search once and store it
  await prisma.destinationResearch.upsert({
    where: { destination_locale: { destination: key, locale } },
    create: { destination: key, locale, content },
    update: { content },
  });
  return content;
}
```

`researchDestination()` is the only place that still keeps a larger `web_search` budget (5 uses); it does a one-time, thorough pass of general knowledge about "this destination," stores it in the cache, and doesn't get re-researched for 14 days. `generateItinerary()` and `chatRefine()` were changed to feed the cached research notes directly into the system prompt as reference material, keeping only 2–3 searches of their own budget for genuinely date-bound queries — like "the weather on these specific days" — that the cache can't help with.

This is essentially a simplified version of the **RAG (Retrieval-Augmented Generation) pattern**: instead of letting the LLM re-search everything from scratch every time, previously researched knowledge is stored, and "retrieval" replaces "re-querying," with the retrieved content stuffed into the prompt for the LLM to use. The difference from textbook RAG is that this uses "destination name" as a direct table lookup key, not a vector database doing semantic retrieval — which is plenty for this use case, and avoids the operational overhead of maintaining an embeddings + vector database stack. Good resume material: "designed a RAG-style knowledge cache layer to reduce redundant LLM calls and external search costs."

### 18.3 Other cost optimizations done in the same pass

- **Model selection by call purpose**: lower-stakes, short-output calls like `suggestInterests` (interest tags) and `quickSuggestions` (quick-question buttons) were switched to the roughly 3x cheaper `claude-haiku-4-5` (configurable via the `ANTHROPIC_FAST_MODEL` env var), while the main itinerary generation/chat still uses `claude-sonnet-5`.
- **Prompt caching**: the system prompt in `chatRefine()` stuffs the full itinerary JSON into it (multi-day itineraries can easily run past a thousand tokens), so `cache_control: { type: "ephemeral" }` was added so that repeated calls (retries within the same request, consecutive chat turns on the same trip) can hit the cache and save most of the token cost of the repeated input.
- **Validating required fields in LLM output**: an earlier version of `extractJson()` only checked "is this valid JSON," not "does it have the fields I need" — at one point Claude returned JSON missing the `reply` field, causing a `Prisma content is missing` error when writing to the database. The fix was to proactively validate required fields inside the extract callback of `createJsonMessage` and throw if any were missing, letting the existing "retry and repair" mechanism take over instead of letting bad data quietly flow through to the database layer. This experience itself is worth putting on a resume: "diagnosed and fixed a field-validation gap in LLM structured output."

---

## Phase 19: Automated Testing (Vitest)

Once the MVP and the Phase 16–18 features were all done, a Vitest test suite was added covering the logic on both frontend and backend that's most likely to break and most worth testing — not to chase coverage numbers, but to target the parts where "breaking it would actually cause real damage, and it can be tested without a real database connection or a real Claude API call."

### 19.1 Backend: `backend/src/**/*.test.ts`

Uses Vitest + `supertest` (issues real HTTP requests against the Express app without actually binding a port) + `vi.mock()` (mocks out `../db/prisma` and `@anthropic-ai/sdk`, since the test environment has no real `DATABASE_URL` / `ANTHROPIC_API_KEY`, so every test must be fully self-contained):

- `services/anthropic.service.test.ts`: fault-tolerant parsing in `extractJson` / `extractJsonArray` (plain JSON, fenced JSON, text mixed in before/after, malformed input that should throw), and the retry logic in `createJsonMessage` — mocking `messages.create` to return broken JSON on the first few calls, verifying it actually retries, that the retry limit is 3, and that it throws a clear error past that. It also covers the real bug mentioned in Phase 18.3: JSON that's syntactically valid but missing a required field (like `reply`) needs to be caught and trigger a retry, not silently let bad data through.
- `services/destinationResearch.service.test.ts`: cache hit (within TTL, `researchDestination` is not called), cache miss (no cache entry or TTL expired, `researchDestination` is called and the result is `upsert`ed), and destination string normalization (trim + lowercase) are each tested separately.
- `middleware/auth.test.ts`: `requireAuth` returns 401 for a missing header, a malformed header, an invalid token, and an expired token; a valid token populates `req.user` and calls `next()`.
- `controllers/auth.controller.test.ts`: registration hashes the password (rather than storing it in plaintext via `create`), rejects duplicate emails, and login is tested for both correct and incorrect passwords.
- `controllers/trips.controller.test.ts`: **authorization tests** — JWTs signed for two different `userId`s (owner / attacker) each hit the same `tripId`/`itemId`, verifying that a non-owner always gets a 404 (rather than a 403 that would leak "this record exists but you don't have access to it"), covering read, rename, delete-trip, and edit/delete-item. This suite pins down the `assertItemOwnership` authorization logic from Phase 6 in a repeatable, automated way, so that if a future code change accidentally breaks the authorization check, a single `npm test` run catches it instead of finding out only after a real security incident (currently still run manually — not yet wired into CI, see "Future Extensions").

### 19.2 Frontend: `frontend/src/**/*.test.tsx`

Uses Vitest + `@testing-library/react` (in a `jsdom` environment) + `@testing-library/user-event`, testing only components that have actual logic — purely presentational static components aren't tested:

- `components/PlannerForm.test.tsx`: the date/time validation logic from Phase 16 — same-day departure time earlier than arrival time is blocked with an error, cross-day cases aren't falsely flagged, the number of days is correctly derived from the date range with the input disabled, and changing the arrival date auto-clears an existing departure date that's now invalid.
- `contexts/LocaleContext.test.tsx`: `t()` behavior for known/unknown keys, translations updating after a language switch, the choice persisting in `localStorage`, and `useLocale()` throwing when used outside a `LocaleProvider`.

### 19.3 Why the coverage was scoped this way

Test priority wasn't "every file needs a test" — it followed this order of thinking: how severe are the consequences if this logic breaks (an authorization hole > a UI validation bug > a purely cosmetic issue), does this logic have branches/edge cases worth testing in the first place (the fault-tolerant parsing in `extractJson`, the edge cases in date comparisons, both have clear right/wrong cases), and can it be tested without hitting a real external service (which is why Prisma and the Anthropic SDK are both mocked at the module boundary). Good resume material: "built backend API integration tests with Vitest + Supertest, covering LLM output fault-tolerant parsing and resource-level authorization; covered frontend form validation and locale-switching logic with Vitest + React Testing Library."

How to run them:

```bash
cd backend && npm test          # or npm run test:watch / npm run test:coverage
cd frontend && npm test         # or npm run test:watch
```

---

## Phase 20: AI-Agent-Assisted Development — Dividing Work with Subagents

This project itself was built using Claude Code as a development tool. `.claude/agents/` defines two project-scoped subagents that split "writing tests" and "maintaining docs" into their own roles with clear responsibilities and clear constraints, rather than dumping everything on the same general-purpose conversation and re-explaining context every time:

- **`tester`** (`.claude/agents/tester.md`): dedicated to automated tests for `backend/`/`frontend/`. Its config spells out a hard constraint — this environment has no real `.env`, so every test must mock out Prisma and the Anthropic SDK, and can't depend on a real database or API — and lists a priority order for what's most worth testing in this repo (LLM JSON fault-tolerant parsing > destination caching > authorization checks > frontend validation logic), which lines up one-to-one with the test suite actually built in Phase 19.
- **`writer`** (`.claude/agents/writer.md`): dedicated to maintaining `TUTORIAL.md` / `README.md`, with rules like "read the code before writing," "every file path/function name in the docs must be checked against the source," and "new work always gets appended as the next Phase, never inserted in the middle with renumbering." The fact that this tutorial stays in sync with the code (for example, catching that the `WEB_SEARCH_TOOL` constant had actually been refactored into the `webSearchTool(maxUses)` function) is a direct result of this subagent being required to "re-read what it just wrote against the source before finishing."

This is a concrete, verifiable story about "using AI agents to assist development" for a resume — not a vague "I used AI to write code," but a clear account of how the work was split into subagents with well-defined responsibility boundaries (each with scoped tool permissions and explicit acceptance criteria — for example, `tester` is required to actually run `npm test` and `tsc --noEmit` before reporting done), with a mechanism in place so the docs don't drift as the code evolves. Good resume material: "designed a project-scoped AI subagent workflow (test writing, documentation maintenance), defining clear responsibility boundaries and hard constraints for each agent to ensure output is verifiable and stays in sync with the source code."

---

## Future Extensions (to make the project more complete and give you more to talk about in interviews)

- **Deployment**: frontend to Vercel (made by the same company as Next.js, so setup is simplest there), backend to Render / Railway / Fly.io, and the database is already cloud-hosted on Neon so nothing to change there
- **Dockerization**: write a `Dockerfile` + `docker-compose.yml` for both frontend and backend — a resume line like "containerized deployment"
- **CI/CD**: GitHub Actions to automatically run `tsc --noEmit`, `eslint`, `next build`, and the Phase 19 Vitest suite on every PR — currently all of this is still run manually
- **E2E testing**: Phase 19 covers the unit/integration level (with Prisma and the Anthropic SDK mocked out); there's no real end-to-end test yet that exercises the frontend and backend together through a browser — Playwright would be a good fit here
- **Stricter structured output**: switch to Claude tool use to define a "save itinerary" tool, replacing the current approach of asking for plain JSON via the system prompt
- **Map visualization (Stage 2)**: wire the `location` field into the Google Maps Embed API, add an interactive map next to the itinerary where clicking an attraction card jumps to / highlights the corresponding map marker, and pull attraction photos via the Places API
- **More complete RAG**: as the cached destination notes grow, this could evolve into a vector database (e.g. Postgres's `pgvector` extension, no extra service required) for semantic retrieval, replacing the current simple "look up by destination name" approach

---

## Resume Bullet Suggestions

Here are example bullet points for reference (adjust to match what you actually built):

> **AI Trip Planner** — Full-stack travel itinerary planning app (Next.js / TypeScript / Node.js / PostgreSQL / Claude API)
> - Designed and built a full-stack application integrating Claude API's web search tool, enabling the LLM to look up real-time attraction reviews, recent news, and weather data to dynamically generate feasibility-checked travel itineraries
> - Designed a structured-output prompting strategy with fault-tolerant parsing logic to reliably convert free-form LLM responses into type-safe, persisted data structures
> - Designed a RAG-style destination knowledge cache layer to cut redundant LLM calls and web search costs, and routed lightweight calls to a cheaper model to control overall API spend
> - Designed a normalized relational database schema with Prisma (users/trips/daily itineraries/itinerary items/chat history/destination research cache), supporting user history queries
> - Implemented JWT authentication and resource-level authorization checks, ensuring users can only access/modify their own data
> - Built a dual-mode itinerary management UI supporting both real-time direct edits (check off/delete/modify) and conversational adjustments (chatbot with automatic question/change-request classification and a human-confirmation step), with English/Chinese localization
> - Built frontend and backend test suites with Vitest + Supertest / React Testing Library, covering high-risk logic such as LLM output fault-tolerant parsing, resource-level authorization, and form validation
