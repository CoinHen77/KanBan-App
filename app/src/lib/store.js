import { writable, derived, get } from 'svelte/store';
import { auth, db } from './firebase.js';
import { signInAnonymously, onAuthStateChanged, signInWithPopup, linkWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import { ADOPTED_UID_KEY } from './pairing.js';
import {
  collection, doc, onSnapshot,
  setDoc, updateDoc, deleteDoc, writeBatch, getDocs,
} from 'firebase/firestore';
import { effectiveColumn, uid, todayISO, buildNextRecurrence, seedCards } from './logic.js';

// ── Core stores ───────────────────────────────────────────────────

export const boards = writable(/** @type {import('./types').Board[]} */ ([]));
export const cards = writable(/** @type {import('./types').Card[]} */ ([]));
export const templates = writable(/** @type {import('./types').Template[]} */ ([]));
export const appLoading = writable(true);
export const currentUserId = writable(/** @type {string|null} */ (null));
export const currentAuthUid = writable(/** @type {string|null} */ (null));
export const currentUser = writable(/** @type {import('firebase/auth').User|null} */ (null));

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

// ── Firestore ref helpers ─────────────────────────────────────────

const LEGACY_KEY = 'tasks-app-v2';

function boardsCol(userId) { return collection(db, 'users', userId, 'boards'); }
function cardsCol(userId)  { return collection(db, 'users', userId, 'cards'); }
function boardDoc(userId, id) { return doc(db, 'users', userId, 'boards', id); }
function cardDoc(userId, id)  { return doc(db, 'users', userId, 'cards', id); }

function me() { return get(currentUserId); }

// Remove undefined values so Firestore doesn't reject the write
function clean(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => v === undefined ? null : v));
}

// ── First-run: migrate localStorage or seed ───────────────────────

async function ensureData(userId) {
  const snap = await getDocs(boardsCol(userId));
  if (!snap.empty) {
    localStorage.removeItem(LEGACY_KEY);
    return;
  }

  const raw = localStorage.getItem(LEGACY_KEY);
  const source = raw ? JSON.parse(raw) : seedCards();

  const batch = writeBatch(db);
  for (const b of source.boards || []) batch.set(boardDoc(userId, b.id), clean(b));
  for (const c of source.cards  || []) batch.set(cardDoc(userId, c.id),  clean(c));
  await batch.commit();
  localStorage.removeItem(LEGACY_KEY);
}

// ── Realtime listeners ────────────────────────────────────────────

let unsubBoards = null;
let unsubCards  = null;

function setupListeners(userId) {
  if (unsubBoards) unsubBoards();
  if (unsubCards)  unsubCards();

  appLoading.set(true);

  let boardsReady = false;
  let cardsReady  = false;

  function checkReady() {
    if (boardsReady && cardsReady) appLoading.set(false);
  }

  unsubBoards = onSnapshot(boardsCol(userId), snap => {
    const data = snap.docs
      .map(d => ({ ...d.data(), id: d.id }))
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    boards.set(data);
    boardsReady = true;
    checkReady();
  }, e => {
    console.error('boards listener error:', e);
    boardsReady = true;
    checkReady();
  });

  unsubCards = onSnapshot(cardsCol(userId), snap => {
    cards.set(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    cardsReady = true;
    checkReady();
  }, e => {
    console.error('cards listener error:', e);
    cardsReady = true;
    checkReady();
  });
}

// ── Auth ──────────────────────────────────────────────────────────

onAuthStateChanged(auth, async user => {
  currentUser.set(user);
  if (user) {
    currentAuthUid.set(user.uid);
    const adopted = typeof localStorage !== 'undefined' ? localStorage.getItem(ADOPTED_UID_KEY) : null;
    const effectiveUid = adopted || user.uid;
    // Reset navigation so a stale board ID from the previous session doesn't
    // leave the UI stuck on "Board not found" while the new user's data loads.
    currentView.set('today');
    currentBoardId.set(null);
    currentUserId.set(effectiveUid);
    try {
      await ensureData(effectiveUid);
    } catch (e) {
      console.error('ensureData failed:', e);
    }
    setupListeners(effectiveUid);
  } else {
    signInAnonymously(auth).catch(console.error);
  }
});

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  const user = auth.currentUser;
  try {
    if (user?.isAnonymous) {
      const result = await linkWithPopup(user, provider);
      currentUser.set(result.user); // linkWithPopup doesn't trigger onAuthStateChanged
    } else {
      await signInWithPopup(auth, provider); // onAuthStateChanged handles this
    }
  } catch (e) {
    if (e.code === 'auth/credential-already-in-use') {
      await signInWithPopup(auth, provider);
    } else {
      throw e;
    }
  }
}

export async function signOutUser() {
  await signOut(auth);
}

// ── Card actions ──────────────────────────────────────────────────

export function createCard(boardId) {
  const userId = me();
  if (!userId) return;
  const id = uid();
  const card = clean({
    id,
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
  });
  // Optimistic
  cards.update(cs => [...cs, card]);
  // Persist
  setDoc(cardDoc(userId, id), card);
  editingCardId.set(id);
  return id;
}

export function updateCard(id, patch) {
  const userId = me();
  if (!userId) return;
  const ts = new Date().toISOString();
  const cleaned = clean(patch);
  cards.update(cs => cs.map(c => c.id === id ? { ...c, ...cleaned, updated_at: ts } : c));
  updateDoc(cardDoc(userId, id), { ...cleaned, updated_at: ts });
}

export function deleteCard(id) {
  const userId = me();
  if (!userId) return;
  cards.update(cs => cs.filter(c => c.id !== id));
  deleteDoc(cardDoc(userId, id));
}

export function markCardDone(id) {
  const userId = me();
  if (!userId) return;
  const card = get(cards).find(c => c.id === id);
  if (!card) return;

  const ts = new Date().toISOString();
  const patch = {
    column: 'done',
    completed_at: todayISO(),
    updated_at: ts,
    ...(!card.template_id && card.recurrence ? { template_id: id } : {}),
  };

  const completedCard = { ...card, ...patch };
  const next = completedCard.recurrence
    ? buildNextRecurrence(completedCard, get(cards))
    : null;

  // Optimistic
  cards.update(cs => {
    let updated = cs.map(c => c.id === id ? { ...c, ...patch } : c);
    if (next) updated = [...updated, { ...next, created_at: ts, updated_at: ts }];
    return updated;
  });

  // Persist
  const batch = writeBatch(db);
  batch.update(cardDoc(userId, id), patch);
  if (next) batch.set(cardDoc(userId, next.id), clean({ ...next, created_at: ts, updated_at: ts }));
  batch.commit();
}

export function reopenCard(id) {
  updateCard(id, { column: 'todo', completed_at: null });
}

export function moveCard(id, col) {
  const userId = me();
  if (!userId) return;
  const card = get(cards).find(c => c.id === id);
  if (!card) return;

  let patch = {};

  if (col === 'done') {
    patch = {
      column: 'done',
      completed_at: todayISO(),
      ...(!card.template_id && card.recurrence ? { template_id: id } : {}),
    };
    const completedCard = { ...card, ...patch };
    const next = completedCard.recurrence
      ? buildNextRecurrence(completedCard, get(cards))
      : null;
    const ts = new Date().toISOString();

    cards.update(cs => {
      let updated = cs.map(c => c.id === id ? { ...c, ...patch, updated_at: ts } : c);
      if (next) updated = [...updated, { ...next, created_at: ts, updated_at: ts }];
      return updated;
    });

    const batch = writeBatch(db);
    batch.update(cardDoc(userId, id), { ...patch, updated_at: ts });
    if (next) batch.set(cardDoc(userId, next.id), clean({ ...next, created_at: ts, updated_at: ts }));
    batch.commit();
    return;
  }

  if (col === 'progress') patch = { column: 'progress', completed_at: null };
  else if (col === 'todo')  patch = { column: 'todo',     completed_at: null };
  else if (col === 'today') patch = { column: 'todo', due_date: todayISO(), completed_at: null };

  updateCard(id, patch);
}

// ── Board actions ─────────────────────────────────────────────────

export function createBoard(name, color, parentId = null) {
  const userId = me();
  if (!userId) return;
  const id = uid();
  const board = clean({
    id,
    name: name.trim(),
    color,
    parent_id: parentId || null,
    sort_order: get(boards).length,
    archived: false,
    updated_at: new Date().toISOString(),
  });
  boards.update(bs => [...bs, board]);
  setDoc(boardDoc(userId, id), board);
  currentView.set('board');
  currentBoardId.set(id);
  return id;
}

export function updateBoard(id, patch) {
  const userId = me();
  if (!userId) return;
  const ts = new Date().toISOString();
  const cleaned = clean(patch);
  boards.update(bs => bs.map(b => b.id === id ? { ...b, ...cleaned, updated_at: ts } : b));
  updateDoc(boardDoc(userId, id), { ...cleaned, updated_at: ts });
}

export function archiveBoard(id) {
  updateBoard(id, { archived: true });
  currentView.set('today');
  currentBoardId.set(null);
}
