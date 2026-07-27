# AI Trip Planner

A full-stack web app that plans trips with AI. The user enters the number of days, a destination, and preferences; Claude searches the web for popular attractions, restaurant reviews, recent news, and weather information, and produces a complete itinerary. Users can check off, delete, or edit itinerary items, or ask the AI to adjust the plan through a chat dialog (swap an attraction, extend a stay, etc.). Everything is saved to a database, and the UI supports switching between Chinese and English.

📘 **Want to build it from scratch yourself? See [TUTORIAL.md](./TUTORIAL.md)** — a full progressive tutorial that explains the reasoning behind every technical decision, useful as study notes or interview prep.

## Tech Stack

| | |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL (Prisma ORM; [Neon](https://neon.tech) / [Supabase](https://supabase.com) free tier both work) |
| AI | Claude API (`@anthropic-ai/sdk`), using the `web_search` tool for real-time lookups |
| Auth | JWT (email/password login) |

## Features

- AI generates a complete daily itinerary based on number of days, destination, interests, must-see attractions/restaurants, travel style, and budget
- The AI searches the web for popular attractions/restaurant reviews, news from the last 1–2 years, and weather to inform planning, and provides a feasibility assessment
- Itinerary items can be checked off, deleted, edited (time/duration/description), or swapped out by the AI
- Ongoing chat with the AI for live itinerary adjustments
- A "My Trips" page keeps all past trips
- Chinese / English UI switching

## Project Structure

```
ai-trip-planner/
├── backend/    # Express API server
├── frontend/   # Next.js app
└── TUTORIAL.md # Full tutorial, built from scratch
```

## Quick Start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY
npx prisma migrate dev --name init
npm run dev             # http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # defaults to http://localhost:4000/api
npm run dev              # http://localhost:3000
```

For step-by-step instructions, design rationale, and future extension ideas, see [TUTORIAL.md](./TUTORIAL.md).
