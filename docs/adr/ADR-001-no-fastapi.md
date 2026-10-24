# ADR-001: No FastAPI service; Supabase SQL functions stay the API

- Status: accepted, 24 Oct 2026 (Alec)
- Deviates from: Piers' Technical Requirements §1.1, §1.4, §2, §3.1, §6 (backend stack and layout)

## Context

The Daily Noodle's backend is the Supabase project `digi`: a write-only `log_events`
function, the private `board` schema reached only through `public.board_*` functions,
and admin functions. All are SQL migrations in `dailynoodle/toolchain/sql/`, tested
against PGlite in that repo's CI. The audience is about ten friends and family.

## Decision

The app calls those Supabase functions directly with `@supabase/supabase-js` and the
public anon key, exactly as the website does. No FastAPI, SQLAlchemy or Alembic
service is built. New server logic (sign-in sync, WP7) is added the same way: SQL
migrations in the site repo with row-level security, tested in `backend.test.js`.

## Consequences

- No hosted process, second deployment pipeline or migration of working logic.
- Typed client: `supabase gen types` output committed and regenerated on migration,
  in place of an OpenAPI-generated client (HeyAPI).
- Revisit if the app needs logic Postgres functions cannot express cleanly (push
  scheduling, third-party calls); the `board-push` edge function shows that shape.
