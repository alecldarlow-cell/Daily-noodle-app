# ADR-003: The static site stays; no Next.js rebuild

- Status: accepted, 24 Oct 2026 (Alec)
- Deviates from: Piers' Technical Requirements §1.2, §2 (Next.js frontend, monorepo)

## Context

`alecldarlow-cell/dailynoodle` is a tested static build on GitHub Pages: the target of
four scheduled publishing tasks, an archive of ~5,200 puzzle pages, and a test suite
that gates every deploy. Players' streaks depend on its storage keys and paths.

## Decision

The website is not rebuilt. The app is a separate Expo project in this repo, reading
what the site's pipeline publishes. The shared rules package (`@noodle/core`) is the
one piece the site may adopt, once proven identical to `dn-core.js`.

## Consequences

The monorepo layout `backend/ frontend/` does not apply. This repo is a plain Expo
project with `packages/core` as an npm workspace.
