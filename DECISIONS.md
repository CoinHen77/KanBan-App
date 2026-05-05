# Architecture Decisions

## Column storage: never store 'today'

The `column` field in the DB has a check constraint allowing only `todo`, `progress`, `done`. The `today` column is always derived at read time via `effectiveColumn()`. This means:
- No background job needed to flip cards between todo/today as midnight passes — it's always computed fresh
- Drag-to-today sets `due_date = today` and `column = 'todo'`; the card appears in Today because of the date, not a stored column value
- Drag from today to todo: prompts for a future date so the card doesn't snap back

## Recurrence: template_id self-reference

The first instance of a recurring card sets `template_id = its own id`. Subsequent spawned cards inherit that same `template_id`. This means:
- Dedup check is: `template_id === X AND due_date === next AND column !== 'done'`
- No separate `templates` table lookups needed for the recurrence engine at runtime
- The `templates` table is for managing recurring task *definitions* (title, recurrence rule) independently of any active card instances

## Supabase anonymous auth

On first launch, the app calls `supabase.auth.signInAnonymously()` and stores the session in localStorage. This anonymous user becomes the permanent identity. Consequences:
- No email/password required
- If localStorage is cleared, identity is lost (new anonymous user, no access to old data)
- Device pairing solves the multi-device case

## Device pairing: code-based, not email

An alternative was to use email-based account linking. Rejected because: users would need email addresses and this is a personal productivity tool. The 6-char alphanumeric code (5-min TTL) is simpler for the single-user, multi-device case.

The migration when Device B enters Device A's code requires moving all of Device B's data (boards, cards, templates) to Device A's `user_id`. This cannot be done from the frontend under RLS — it requires a Supabase Edge Function that runs with the service role key.

## Sync: last-write-wins by `updated_at`

On real-time events, incoming rows are accepted if their `updated_at` is newer than the local copy. This is simple, correct for a single-user app, and avoids conflict resolution complexity. For a multi-user app this would need CRDTs or operational transforms.

## Offline queue in localStorage

Failed writes are stored in `localStorage` as an array of `{ table, op, row, timestamp }`. On reconnect, the queue is flushed in FIFO order. This means offline writes may be reordered relative to online writes from another device. Acceptable for a personal task manager.

## PWA: cache-first for app shell, network-first for API

The app shell (HTML, CSS, JS bundles) is cached at install time and served cache-first. Supabase REST calls use network-first with a localStorage fallback (local state). This gives full offline capability after first load.

## Svelte stores for state

All state lives in Svelte writable stores (`boards`, `cards`, etc.) backed by localStorage. Supabase will be added as a side-effect layer that hydrates these stores on load and subscribes to real-time updates — the components never talk to Supabase directly.
