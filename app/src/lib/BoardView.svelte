<script>
  import { cards, boards, currentBoardId, currentView, editingCardId, createCard, moveCard, updateCard, deleteCard, editingBoardId, showBoardModal } from './store.js';
  import { effectiveColumn, isOverdue, isWaitingStale, sortTodo, sortDone, formatDateRel, todayISO, COLUMN_NAMES } from './logic.js';
  import BoardCard from './BoardCard.svelte';

  const COLS = ['todo', 'today', 'progress', 'done'];

  $: board = $boards.find(b => b.id === $currentBoardId);
  $: boardCards = $cards.filter(c => c.board_id === $currentBoardId);
  $: grouped = groupCards(boardCards);
  $: recurringCount = boardCards.filter(c => c.recurrence || c.template_id).length;
  $: activeCount = boardCards.filter(c => c.column !== 'done').length;

  // Done column: hide cards older than 7 days unless showOlderDone is set
  let showOlderDone = false;
  $: doneSorted = sortDone(grouped.done || []);
  $: doneRecent = doneSorted.filter(c => {
    if (!c.completed_at) return true;
    const d = new Date(c.completed_at);
    return (Date.now() - d.getTime()) < 7 * 86400000;
  });
  $: doneOlder = doneSorted.filter(c => {
    if (!c.completed_at) return false;
    return (Date.now() - new Date(c.completed_at).getTime()) >= 7 * 86400000;
  });

  function groupCards(cs) {
    const g = { todo: [], today: [], progress: [], done: [] };
    cs.forEach(c => g[effectiveColumn(c)].push(c));
    g.todo = sortTodo(g.todo);
    g.today = [...g.today].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
    return g;
  }

  // Drag and drop
  let dragCardId = null;
  let rescheduleCardId = null;
  let rescheduleDate = '';

  function onDragOver(e, col) {
    e.preventDefault();
    e.currentTarget.classList.add('drop-target');
  }
  function onDragLeave(e) {
    e.currentTarget.classList.remove('drop-target');
  }
  function onDrop(e, col) {
    e.preventDefault();
    e.currentTarget.classList.remove('drop-target');
    if (!dragCardId) return;

    const c = $cards.find(x => x.id === dragCardId);
    if (!c) return;

    if (col === 'todo' && effectiveColumn(c) === 'today') {
      // Open reschedule modal instead of prompt()
      rescheduleCardId = dragCardId;
      rescheduleDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    } else {
      moveCard(dragCardId, col);
    }
    dragCardId = null;
  }

  function confirmReschedule() {
    if (!rescheduleCardId) return;
    updateCard(rescheduleCardId, { column: 'todo', due_date: rescheduleDate || null });
    rescheduleCardId = null;
  }

  function cancelReschedule() {
    rescheduleCardId = null;
  }

  function openNewTask() {
    if (!$currentBoardId) return;
    createCard($currentBoardId);
  }

  function openRenameBoard() {
    editingBoardId.set($currentBoardId);
    showBoardModal.set(true);
  }

  function clearDone() {
    const count = doneSorted.length;
    if (!count) return;
    if (!confirm(`Delete all ${count} completed task${count === 1 ? '' : 's'} on this board?`)) return;
    doneSorted.forEach(c => deleteCard(c.id));
  }
</script>

{#if board}
  <header class="main-header">
    <div>
      <div style="display: flex; align-items: baseline; gap: 8px;">
        <h1 class="main-title">{board.name}</h1>
        <button class="rename-btn" on:click={openRenameBoard} title="Rename workflow">✎</button>
      </div>
      <div class="main-subtitle">
        {activeCount} active{recurringCount ? ` · ${recurringCount} recurring` : ''}
      </div>
    </div>
    <div class="header-actions">
      <button class="btn btn-primary" on:click={openNewTask}>+ New task</button>
    </div>
  </header>

  <div class="board-area">
    <div class="columns">
      {#each COLS as col}
        {@const colCards = col === 'done' ? (showOlderDone ? doneSorted : doneRecent) : (grouped[col] || [])}
        {@const todoNoDueDate = col === 'todo' ? (grouped.todo || []).filter(c => !c.due_date) : []}
        {@const todoDated = col === 'todo' ? (grouped.todo || []).filter(c => c.due_date) : []}

        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="column"
          data-col={col}
          on:dragover={e => onDragOver(e, col)}
          on:dragleave={onDragLeave}
          on:drop={e => onDrop(e, col)}
        >
          <div class="column-head">
            <div class="column-name" class:italic={col === 'today'}>{COLUMN_NAMES[col]}</div>
            <div style="display:flex; align-items:center; gap:6px;">
              {#if col === 'done' && doneSorted.length > 0}
                <button class="clear-done-btn" on:click={clearDone} title="Delete all completed">Clear</button>
              {/if}
              <div class="column-count">{colCards.length}{col === 'done' && doneOlder.length && !showOlderDone ? ` (+${doneOlder.length})` : ''}</div>
            </div>
          </div>
          <div class="column-body">
            {#if col === 'todo'}
              {#each todoDated as card (card.id)}
                <BoardCard {card} on:dragstart={e => { dragCardId = card.id; }} on:dragend={() => {}} />
              {/each}
              {#if todoNoDueDate.length}
                {#if todoDated.length}
                  <div class="no-date-sep">No due date</div>
                {/if}
                {#each todoNoDueDate as card (card.id)}
                  <BoardCard {card} on:dragstart={e => { dragCardId = card.id; }} on:dragend={() => {}} />
                {/each}
              {/if}
              <div class="column-add" on:click={openNewTask} role="button" tabindex="0" on:keydown={e => e.key === 'Enter' && openNewTask()}>+ Add task</div>
            {:else}
              {#each colCards as card (card.id)}
                <BoardCard {card} on:dragstart={() => { dragCardId = card.id; }} on:dragend={() => {}} />
              {/each}
              {#if col === 'done' && doneOlder.length && !showOlderDone}
                <button class="show-older" on:click={() => showOlderDone = true}>Show {doneOlder.length} older…</button>
              {/if}
            {/if}

            {#if colCards.length === 0 && col !== 'todo'}
              <div class="empty" style="padding: 24px 12px;">—</div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
{:else}
  <div class="empty" style="padding: 80px 32px;">Board not found.</div>
{/if}

{#if rescheduleCardId}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click|self={cancelReschedule}>
    <div class="modal">
      <div class="modal-header">
        <span style="font-size: 13px; font-weight: 500;">Reschedule</span>
        <button class="modal-close" on:click={cancelReschedule}>×</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <div class="field-label">New due date</div>
          <input class="field-input" type="date" bind:value={rescheduleDate}>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" on:click={confirmReschedule}>Reschedule</button>
          <button class="btn" on:click={() => { updateCard(rescheduleCardId, { column: 'todo', due_date: null }); rescheduleCardId = null; }}>No date (To Do)</button>
          <button class="btn" on:click={cancelReschedule}>Cancel</button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .main-header {
    padding: 24px 32px 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 1px solid var(--line);
  }
  .main-title { font-family: var(--serif); font-size: 32px; font-weight: 500; letter-spacing: -0.8px; line-height: 1; }
  .rename-btn {
    background: none;
    border: none;
    color: var(--ink-3);
    font-size: 16px;
    cursor: pointer;
    padding: 2px 4px;
    opacity: 0;
    transition: opacity 0.15s;
    line-height: 1;
    align-self: center;
  }
  .main-header:hover .rename-btn { opacity: 1; }
  .rename-btn:hover { color: var(--ink); }
  .main-subtitle { font-size: 12px; color: var(--ink-3); margin-top: 6px; letter-spacing: 0.2px; }
  .header-actions { display: flex; gap: 8px; }

  .board-area { flex: 1; overflow: hidden; padding: 20px 32px 32px; }
  .columns {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    height: 100%;
  }
  .column {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  :global(.column.drop-target) { border-color: var(--accent); background: var(--accent-bg); }
  .column-head {
    padding: 14px 14px 10px;
    border-bottom: 1px solid var(--line);
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .column-name { font-family: var(--serif); font-size: 14px; font-weight: 500; letter-spacing: -0.2px; }
  .italic { font-style: italic; }
  .column-count { font-size: 11px; color: var(--ink-3); }
  .column-body { padding: 8px; overflow-y: auto; flex: 1; }
  .column-add {
    padding: 8px 12px;
    color: var(--ink-3);
    font-size: 12px;
    cursor: pointer;
    border-radius: 6px;
    border: 1px dashed transparent;
    margin: 4px;
    text-align: center;
  }
  .column-add:hover { color: var(--ink); border-color: var(--line-strong); }
  .no-date-sep {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--ink-3);
    padding: 8px 4px 4px;
    font-weight: 500;
  }
  .show-older {
    display: block;
    width: 100%;
    text-align: center;
    font-size: 11px;
    color: var(--ink-3);
    padding: 8px;
    cursor: pointer;
    background: none;
    border: none;
    font-family: inherit;
  }
  .show-older:hover { color: var(--ink); }
  .clear-done-btn {
    background: none;
    border: none;
    font-size: 10px;
    color: var(--ink-3);
    cursor: pointer;
    padding: 1px 4px;
    font-family: inherit;
    letter-spacing: 0.2px;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .column-head:hover .clear-done-btn { opacity: 1; }
  .clear-done-btn:hover { color: var(--coral); }

  @media (max-width: 768px) {
    .main-header { padding: 16px 18px 12px; flex-direction: column; align-items: flex-start; gap: 10px; }
    .main-title { font-size: 24px; }
    .board-area { padding: 12px 18px 18px; overflow: visible; }
    .columns { grid-template-columns: 1fr; gap: 10px; height: auto; }
    .column { min-height: 100px; }
    .column-body { overflow: visible; }
  }
</style>
