// Core business logic — ported directly from prototype.
// No UI dependencies. Pure functions only.

export const COLUMNS = /** @type {const} */ (['todo', 'today', 'progress', 'done']);
export const COLUMN_NAMES = { todo: 'To Do List', today: 'Today', progress: 'In Progress', done: 'Complete' };
export const BOARD_COLORS = [
  '#8b5a3c', '#5a7548', '#3c6b8b', '#8b3c5a',
  '#b8862a', '#5a3c8b', '#3c8b8b', '#8b5a8b',
];

// ── Date helpers ──────────────────────────────────────────────────

function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayISO() {
  return localISO(new Date());
}

export function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localISO(d);
}

/** Days from a → b (positive = b is future) */
export function daysBetween(a, b) {
  return Math.floor((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}

export function uid() {
  return Math.random().toString(36).slice(2, 11);
}

// ── Column derivation (THE critical rule) ─────────────────────────

/**
 * Derive display column. progress/done are explicit. today/todo are derived.
 * The DB never stores 'today' — only 'todo', 'progress', 'done'.
 * @param {import('./types').Card} card
 * @returns {'todo'|'today'|'progress'|'done'}
 */
export function effectiveColumn(card) {
  if (card.column === 'progress' || card.column === 'done') return card.column;
  if (card.due_date && card.due_date <= todayISO()) return 'today';
  return 'todo';
}

// ── Status helpers ────────────────────────────────────────────────

/** @param {import('./types').Card} card */
export function isOverdue(card) {
  return !!(card.due_date && card.due_date < todayISO() && card.column !== 'done');
}

/** @param {import('./types').Card} card */
export function isWaitingStale(card) {
  if (!card.waiting_on) return false;
  return daysBetween(card.waiting_on.since, todayISO()) >= 14;
}

/** @param {import('./types').Card} card */
export function waitingDays(card) {
  if (!card.waiting_on) return 0;
  return daysBetween(card.waiting_on.since, todayISO());
}

// ── Recurrence ────────────────────────────────────────────────────

/**
 * @param {string} from  ISO date to compute from
 * @param {import('./types').RecurrenceRule} rec
 * @returns {string|null}
 */
export function computeNextDueDate(from, rec) {
  const start = new Date(from + 'T00:00:00');

  if (rec.freq === 'daily') {
    start.setDate(start.getDate() + 1);
    return start.toISOString().slice(0, 10);
  }

  if (rec.freq === 'weekly') {
    const days = (rec.days && rec.days.length) ? rec.days.slice().sort((a, b) => a - b) : [start.getDay()];
    for (let i = 1; i <= 14; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      if (days.includes(d.getDay())) return d.toISOString().slice(0, 10);
    }
  }

  if (rec.freq === 'monthly') {
    const d = new Date(start);
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Build the new card to spawn when a recurring card is completed.
 * Returns null if the next instance already exists (dedup check).
 *
 * @param {import('./types').Card} completedCard
 * @param {import('./types').Card[]} allCards
 * @returns {import('./types').Card|null}
 */
export function buildNextRecurrence(completedCard, allCards) {
  const rec = completedCard.recurrence;
  if (!rec) return null;

  const next = computeNextDueDate(completedCard.due_date || todayISO(), rec);
  if (!next) return null;

  const tplId = completedCard.template_id || completedCard.id;

  // Don't double-spawn
  const exists = allCards.find(c =>
    c.template_id === tplId &&
    c.due_date === next &&
    c.column !== 'done'
  );
  if (exists) return null;

  return {
    id: uid(),
    board_id: completedCard.board_id,
    template_id: tplId,
    title: completedCard.title,
    notes: completedCard.notes,
    column: 'todo',
    due_date: next,
    subtasks: completedCard.subtasks.map(s => ({ id: uid(), text: s.text, done: false })),
    waiting_on: null,
    recurrence: completedCard.recurrence,
  };
}

// ── Sorting ───────────────────────────────────────────────────────

/** Sort todo column: dated cards asc, undated cards at bottom */
export function sortTodo(cards) {
  return [...cards].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });
}

/** Sort done column: most recently completed first */
export function sortDone(cards) {
  return [...cards].sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
}

// ── Date formatting ───────────────────────────────────────────────

export function formatDateLong(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function formatDateRel(iso) {
  if (!iso) return '';
  const today = todayISO();
  if (iso === today) return 'Today';
  const tomorrow = tomorrowISO();
  if (iso === tomorrow) return 'Tomorrow';
  const days = daysBetween(today, iso);
  if (days < 0) return `${-days}d overdue`;
  if (days <= 7) return `In ${days}d`;
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Seed data (for first-run localStorage) ────────────────────────

export function seedCards() {
  const today = todayISO();
  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  const yesterday = localISO(yd);
  const tomorrow = tomorrowISO();
  const nw = new Date(); nw.setDate(nw.getDate() + 7);
  const nextWeek = localISO(nw);
  const la = new Date(); la.setDate(la.getDate() - 16);
  const longAgo = localISO(la);

  const generalId = uid(), clientBId = uid(), clientCId = uid();

  const boards = [
    { id: generalId, name: 'General',  color: '#5a554c', sort_order: 0, archived: false },
    { id: clientBId, name: 'Client B', color: '#3c6b8b', sort_order: 1, archived: false },
    { id: clientCId, name: 'Client C', color: '#5a7548', sort_order: 2, archived: false },
  ];

  const tpl1 = uid();
  const cards = [
    { id: tpl1, board_id: clientBId, title: 'Send Q2 deck to Client B', notes: 'Include updated revenue projections and screenshots from the new dashboard build.', column: 'progress', due_date: today, subtasks: [
      { id: uid(), text: 'Pull latest numbers', done: true },
      { id: uid(), text: 'Export dashboard screenshots', done: true },
      { id: uid(), text: 'Write cover email', done: false },
      { id: uid(), text: 'Schedule send for 5pm', done: false },
    ], waiting_on: null, recurrence: { freq: 'weekly', days: [4] }, template_id: tpl1 },
    { id: uid(), board_id: clientCId, title: 'Review Client C contract redlines', notes: '', column: 'todo', due_date: today, subtasks: [], waiting_on: { text: 'Sarah (Legal)', since: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10) }, recurrence: null },
    { id: uid(), board_id: generalId, title: 'Submit weekly timesheet', notes: '', column: 'todo', due_date: today, subtasks: [], waiting_on: null, recurrence: { freq: 'weekly', days: [5] }, template_id: uid() },
    { id: uid(), board_id: clientBId, title: 'Draft SOW amendment', notes: 'New scope items from last call.', column: 'todo', due_date: tomorrow, subtasks: [], waiting_on: null, recurrence: null },
    { id: uid(), board_id: clientBId, title: 'Onboarding doc v2', notes: '', column: 'progress', due_date: nextWeek, subtasks: [
      { id: uid(), text: 'Outline new sections', done: true },
      { id: uid(), text: 'First draft', done: false },
    ], waiting_on: null, recurrence: null },
    { id: uid(), board_id: clientCId, title: 'Procurement vendor form', notes: '', column: 'todo', due_date: yesterday, subtasks: [], waiting_on: { text: 'Procurement team', since: longAgo }, recurrence: null },
    { id: uid(), board_id: generalId, title: 'Research competitor pricing', notes: '', column: 'todo', due_date: null, subtasks: [], waiting_on: null, recurrence: null },
    { id: uid(), board_id: clientBId, title: 'Kickoff notes', notes: '', column: 'done', due_date: yesterday, subtasks: [], waiting_on: null, recurrence: null, completed_at: yesterday },
  ];

  return { boards, cards };
}
