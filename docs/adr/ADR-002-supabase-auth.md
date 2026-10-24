# ADR-002: Supabase Auth (magic links), not hand-rolled bcrypt/JWT

- Status: accepted, 24 Oct 2026 (Alec)
- Deviates from: Piers' Technical Requirements §1.1 Auth Rules (development)

## Context

Sign-in is optional and exists only so saves and streaks can follow a player between
phones (WP7). Magic-link Supabase Auth already protects the site's `admin.html`.
Piers' doc names Supabase Auth as the production intent (§9).

## Decision

Use Supabase Auth email magic links on web and app. No passwords are stored.

## Consequences

No password storage or reset flow to build; one auth system across the site and app.
