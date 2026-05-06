# KanBan App

Personal kanban task manager. SvelteKit + Firebase + PWA, deployed on Netlify.

**Live site:** [Netlify — auto-deploys from `main`]  
**Repo:** https://github.com/CoinHen77/KanBan-App

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | SvelteKit (JS, no TypeScript), static adapter |
| Database | Firebase Firestore (realtime listeners) |
| Auth | Firebase Anonymous Auth + Google Sign-In |
| Hosting | Netlify |
| Offline | Workbox service worker (PWA) |

---

## Features

### Views
- **Today** — overdue tasks, due today, in progress (with due date), subtasks due today, and "up next" (tomorrow). Filterable by Waiting On.
- **Waiting On** — all blocked tasks, split into stale (14+ days) and active. Sorted by age.
- **Board** — four-column kanban per workflow: To Do List · Today · In Progress · Complete.

### Task cards
- Title, notes, due date, recurrence (daily / weekly by day / monthly)
- Subtasks with individual due dates — overdue subtasks surface in the Today view
- Waiting On field (blocker / person / dependency) with staleness tracking (14-day threshold)
- Move-to-board button — hover a card to reassign it to another workflow
- Drag and drop between columns; dragging Today → To Do opens a reschedule modal

### Workflows (boards)
- Parent / child hierarchy — sub-boards nest under a parent with collapsible sidebar toggle
- Color picker with preset palette + custom color wheel
- Archive / restore boards
- Rename inline from the board header

### Done / Complete column
- Cards older than 7 days are hidden behind a "Show N older…" toggle
- "Clear" button in the column header deletes all completed tasks for that board

### Sync & auth
- Anonymous auth on first load — all data is immediately persisted to Firestore
- Sign in with Google (upgrades anonymous account, preserving all data)
- Device pairing — generate a 6-char code on Device A, enter it on Device B; Device B adopts Device A's Firestore data going forward. Real-time sync across both devices.

### PWA
- Service worker via Workbox (generateSW strategy)
- Offline shell caching — app loads and reads cached data without a network connection
- Offline indicator banner shown when connection is lost
- `200.html` fallback for SPA navigation registered in `additionalManifestEntries`

### Mobile
- Sidebar collapses to a horizontal tab bar (44px touch targets)
- Modals become bottom sheets on screens ≤ 640px (safe-area padding for iOS)
- Board columns stack vertically; body scrolls naturally

### Keyboard shortcuts
| Key | Action |
|---|---|
| `N` | New task (current board, or first board if in Today/Waiting view) |
| `T` | Switch to Today view |
| `W` | Switch to Waiting On view |
| `Esc` | Close open modal |
| `?` | Show shortcuts reference |

Shortcuts are suppressed while typing in any input, textarea, or select, and while the card modal is open.

---

## Project structure

```
app/
  src/
    lib/
      logic.js          # Pure functions: effectiveColumn, date helpers, recurrence
      store.js          # Svelte stores + Firestore persistence + auth
      firebase.js       # Firebase app init
      CardModal.svelte  # Full task editor modal
      BoardCard.svelte  # Kanban card (drag, move-to, meta badges)
      BoardView.svelte  # 4-column board + drag-and-drop
      TodayView.svelte  # Today super-view
      WaitingOnView.svelte
      pairing.js        # Device pairing: code generation, adoption flow
    routes/
      +layout.js        # SSR disabled
      +layout.svelte    # Sidebar, modals, keyboard shortcuts, offline banner
      +page.svelte      # Pairing modal, view router
    app.css             # Global design tokens + shared component styles
    app.html
  vite.config.js        # VitePWA plugin config
  svelte.config.js      # adapter-static, fallback: 200.html
netlify.toml
```

---

## Critical rule

`effectiveColumn(card)` is the single source of truth for where a card appears. The database stores only `'todo' | 'progress' | 'done'` — the `'today'` column is derived (column === 'todo' AND due_date === today). Never bypass this function when reading a card's column.

---

## Local development

```bash
cd app
npm install
# create app/.env with your Firebase config (see .env.example if present)
npm run dev
```

`.env` variables (add to Netlify dashboard for production):
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Deploy

Push to `main` — Netlify auto-deploys. Build command: `cd app && npm run build`. Publish dir: `app/build`.

---

## Known gotchas

- `toISOString()` returns UTC — all date comparisons use local-time helpers (`localISO`) to avoid off-by-one-day errors in US timezones.
- `linkWithPopup` (anonymous → Google upgrade) does not fire `onAuthStateChanged` — `currentUser` store must be set manually from the returned `UserCredential`.
- Service worker registration must be done manually in `onMount`; `injectRegister: 'auto'` does not inject into SvelteKit's HTML pipeline.
- `200.html` is generated by the static adapter after Vite runs, so Workbox glob misses it — registered via `additionalManifestEntries`.
- Firestore security rules require explicit per-collection paths; `{rest=**}` wildcards are unreliable.
