import { writable, derived, get } from 'svelte/store';
import { seedCards, effectiveColumn, uid, todayISO, tomorrowISO, buildNextRecurrence } from './logic.js';

const STORAGE_KEY = 'tasks-app-v2';

// ── Persistence helpers ───────────────────────────────────────────

function loadFromStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function persistToStorage(data) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {}
}

// ── Core stores ───────────────────────────────────────────────────

const saved = loadFromStorage();
const seed = saved || seedCards();

export const boards = writable(seed.boards || []);
export const cards = writable(seed.cards || []);
export const templates = writable(/** @type {import('./types').Template[]} */ ([]));

// Sync writes to localStorage
boards.subscribe(b => {
  const c = get(cards);
  persistToStorage({ boards: b, cards: c });
});
cards.subscribe(c => {
  const b = get(boards);
  persistToStorage({ boards: b, cards: c });
});

// ── Navigation state ──────────────────────────────────────────────

export const currentView = writable(/** @type {'today'|'board'|'waiting'} */ ('today'));
export const currentBoardId = writable(/** @type {string|null} */ (null));
export const todayFilter = writable(/** @type {'all'|'blocked'} */ ('all'));

// ── Modal state ───────────────────────────────────────────────────

/** @type {import('svelte/store').Writable<string|null>} */
export const editingCardId = writable(null);
export const showPairingModal = writable(false);
export const showBoardModal = writable(false);
export const editingBoardId = writable(/** @type {string|null} */ (null));

// ── Derived counts ────────────────────────────────────────────────

export const todayCards = derived(cards, $cards =>
  $cards.filter(c => effectiveColumn(c) === 'today')
);

export const todayCount = derived(todayCards, $tc => $tc.length);

export const waitingCount = derived(cards, $cards =>
  $cards.filter(c => c.column !== 'done' && c.waiting_on).length
);

// ── Card actions ──────────────────────────────────────────────────

export function createCard(boardId) {
  const card = {
    id: uid(),
    board_id: boardId,
    title: '',
    notes: '',
    column: 'todo',
    due_date: null,
    subtasks: [],
    waiting_on: null,
    recurrence: null,
    template_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  cards.update(cs => [...cs, card]);
  editingCardId.set(card.id);
  return card.id;
}

export function updateCard(id, patch) {
  cards.update(cs =>
    cs.map(c => c.id === id ? { ...c, ...patch, updated_at: new Date().toISOString() } : c)
  );
}

export function deleteCard(id) {
  cards.update(cs => cs.filter(c => c.id !== id));
}

export function markCardDone(id) {
  cards.update(cs => {
    const card = cs.find(c => c.id === id);
    if (!card) return cs;

    const updated = cs.map(c =>
      c.id === id
        ? { ...c, column: 'done', completed_at: todayISO(), updated_at: new Date().toISOString() }
        : c
    );

    // Ensure template_id is set before spawning
    const completedCard = { ...card, column: 'done', completed_at: todayISO() };
    if (!completedCard.template_id && completedCard.recurrence) {
      completedCard.template_id = completedCard.id;
      // Also patch the stored card
      const idx = updated.findIndex(c => c.id === id);
      if (idx >= 0) updated[idx] = { ...updated[idx], template_id: completedCard.id };
    }

    if (completedCard.recurrence) {
      const next = buildNextRecurrence(completedCard, updated);
      if (next) {
        next.updated_at = new Date().toISOString();
        next.created_at = new Date().toISOString();
        updated.push(next);
      }
    }

    return updated;
  });
}

export function reopenCard(id) {
  updateCard(id, { column: 'todo', completed_at: null });
}

export function moveCard(id, col) {
  cards.update(cs => {
    const card = cs.find(c => c.id === id);
    if (!card) return cs;

    let patch = {};

    if (col === 'done') {
      patch = { column: 'done', completed_at: todayISO() };
      const completedCard = { ...card, ...patch };
      if (!completedCard.template_id && completedCard.recurrence) {
        completedCard.template_id = completedCard.id;
        patch.template_id = completedCard.id;
      }
      const updated = cs.map(c => c.id === id ? { ...c, ...patch, updated_at: new Date().toISOString() } : c);
      if (completedCard.recurrence) {
        const next = buildNextRecurrence(completedCard, updated);
        if (next) {
          next.updated_at = new Date().toISOString();
          next.created_at = new Date().toISOString();
          updated.push(next);
        }
      }
      return updated;
    }

    if (col === 'progress') {
      patch = { column: 'progress', completed_at: null };
    } else if (col === 'todo') {
      patch = { column: 'todo', completed_at: null };
    } else if (col === 'today') {
      // Moving into today: set due_date to today so effectiveColumn returns 'today'
      patch = { column: 'todo', due_date: todayISO(), completed_at: null };
    }

    return cs.map(c => c.id === id ? { ...c, ...patch, updated_at: new Date().toISOString() } : c);
  });
}

// ── Board actions ─────────────────────────────────────────────────

export function createBoard(name, color, parentId = null) {
  const b = get(boards);
  const board = {
    id: uid(),
    name: name.trim(),
    color,
    parent_id: parentId || null,
    sort_order: b.length,
    archived: false,
    updated_at: new Date().toISOString(),
  };
  boards.update(bs => [...bs, board]);
  currentView.set('board');
  currentBoardId.set(board.id);
  return board.id;
}

export function updateBoard(id, patch) {
  boards.update(bs =>
    bs.map(b => b.id === id ? { ...b, ...patch, updated_at: new Date().toISOString() } : b)
  );
}

export function archiveBoard(id) {
  updateBoard(id, { archived: true });
  currentView.set('today');
  currentBoardId.set(null);
}
