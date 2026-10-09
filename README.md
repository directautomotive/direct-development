# Direct Development Group — project ledgers

- `index.html` — front page: all current development projects with live totals.
- `hope.html` — 2729 Hope St ledger (same layout as the original Claude tracker).
- `ddg.js` — shared sign-in and database layer (Supabase project "Direct Development Group").
  Deletes are soft (`deleted_at`); every edit or delete is kept in `entries_history`.

Version 1 — 10/09/26.
