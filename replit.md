# Phonora — Pronunciation Coaching App

## Overview

Phonora is a full-stack pronunciation coaching web app that helps non-native speakers develop a native-like American English accent. Users browse an IPA sound library, practice pronunciation by recording their voice, and receive scored phoneme-level feedback.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (Tailwind CSS, Radix UI, Framer Motion, Wouter)
- **Backend**: Express 5 + Drizzle ORM + PostgreSQL
- **Auth**: Supabase Auth (email/password + Google OAuth via Supabase, Supabase JWT verification on backend)
- **API codegen**: Orval (from OpenAPI spec in `lib/api-spec/openapi.yaml`)
- **State**: Zustand (auth store) + React Query (data fetching)
- **Validation**: Zod (`zod/v4`)

## Artifacts

- `artifacts/phonora` — React + Vite frontend (served at `/`)
- `artifacts/api-server` — Express 5 backend (served at `/api`)

## Database Tables

- `users` — (legacy; auth is now delegated to Supabase Auth; user identity is the Supabase `auth.users` UUID)
- `profiles` — user profile (display_name, native_language, target_accent, streak_days, total_attempts)
- `user_settings` — preferences (theme, daily_goal_minutes, show_phoneme_breakdown)
- `ipa_sounds` — IPA library (symbol, name, category, description, articulation_guide, example_words)
- `practice_attempts` — recorded practice sessions with assessment results
- `daily_activity` — per-day activity counts and avg scores for streak calendar
- `saved_texts` — user-saved practice texts

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/phonora run dev` — run frontend locally

## API Routes

All routes prefixed with `/api`:

**Auth:**
- `POST /auth/signup` — create account
- `POST /auth/login` — get JWT token
- `GET/PATCH /auth/profile` — user profile (authenticated)
- `GET/PATCH /auth/settings` — user settings (authenticated)

**IPA:**
- `GET /ipa/sounds` — list sounds (optional `?category=vowel|consonant|diphthong`)
- `GET /ipa/sounds/:id` — get sound detail
- `POST /ipa/lookup` — CMUdict lookup for text

**Practice:**
- `GET/POST /practice/attempts` — list/create practice attempts
- `GET /practice/attempts/:id` — get single attempt
- `GET/POST /practice/saved-texts` — list/create saved texts
- `DELETE /practice/saved-texts/:id`

**Assessment:**
- `POST /assessment/score` — score audio (mocked if AZURE_SPEECH_KEY missing)

**Dashboard:**
- `GET /dashboard/summary` — aggregate stats
- `GET /dashboard/activity` — daily activity for calendar
- `GET /dashboard/recent-attempts` — recent 5 attempts

## Environment Variables

- `SESSION_SECRET` — JWT signing secret (set in Replit secrets)
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `AZURE_SPEECH_KEY` — Azure Cognitive Services key (optional, mocked if missing)
- `AZURE_SPEECH_REGION` — Azure region (optional)

## Authentication

- JWT tokens stored in `localStorage` as `phonora_token`
- All authenticated routes expect `Authorization: Bearer <token>`
- Google OAuth: placeholder — navigate to `/api/auth/google`
