<script>
  import { cards, boards, currentView, currentBoardId, todayFilter, editingCardId, createCard, markCardDone, updateCard } from './store.js';
  import { effectiveColumn, isOverdue, isWaitingStale, daysBetween, todayISO, tomorrowISO, formatDateLong } from './logic.js';

  $: todayCards = $cards.filter(c => effectiveColumn(c) === 'today');
  $: overdue = todayCards.filter(c => isOverdue(c));
  $: dueToday = todayCards.filter(c => !isOverdue(c));
  $: inProgressCards = $cards.filter(c => c.column === 'progress');
  $: subtasksDueToday = $cards
    .filter(c => c.column !== 'done')
    .flatMap(c =>
      (c.subtasks || [])
        .filter(s => !s.done && s.due_date && s.due_date <= todayISO())
        .map(s => ({ ...s, parentCard: c }))
    );
  $: blocked = [...todayCards, ...inProgressCards].filter(c => c.waiting_on);
  $: upNext = $cards.filter(c =>
    c.column !== 'done' && c.column !== 'progress' &&
    c.due_date === tomorrowISO()
  );
  $: visible = $todayFilter === 'blocked'
    ? [...todayCards, ...inProgressCards].filter(c => c.waiting_on)
    : todayCards;

  function getBoard(boardId) {
    return $boards.find(b => b.id === boardId);
  }

  function getBoardLabel(boardId) {
    const board = $boards.find(b => b.id === boardId);
    if (!board) return '';
    if (board.parent_id) {
      const parent = $boards.find(b => b.id === board.parent_id);
      return parent ? `${parent.name} / ${board.name}` : board.name;
    }
    return board.name;
  }

  function navigateToBoard(e, boardId) {
    e.stopPropagation();
    currentView.set('board');
    currentBoardId.set(boardId);
  }

  function toggleSubtaskDone(cardId, subtaskId) {
    const card = $cards.find(c => c.id === cardId);
    if (!card) return;
    const subs = card.subtasks.map(s => s.id === subtaskId ? { ...s, done: !s.done } : s);
    updateCard(cardId, { subtasks: subs });
  }

  function handleCheck(e, cardId) {
    e.stopPropagation();
    const c = $cards.find(x => x.id === cardId);
    if (!c) return;
    if (c.column === 'done') {
      import('./store.js').then(m => m.reopenCard(cardId));
    } else {
      markCardDone(cardId);
    }
  }

  function handleNewTask() {
    const defaultBoard = $boards.filter(b => !b.archived)[0];
    if (!defaultBoard) { alert('Create a workflow first.'); return; }
    createCard(defaultBoard.id);
  }
</script>

<header class="main-header">
  <div>
    <h1 class="main-title">
      <span class="em">Today</span>
      <span class="date-sub">— {formatDateLong(todayISO())}</span>
    </h1>
    <div class="main-subtitle">
      {todayCards.length} due{inProgressCards.length ? ` · ${inProgressCards.length} in progress` : ''}{subtasksDueToday.length ? ` · ${subtasksDueToday.length} subtask${subtasksDueToday.length === 1 ? '' : 's'}` : ''}{blocked.length ? ` · ${blocked.length} waiting` : ''}
    </div>
  </div>
  <div class="header-actions">
    <button class="btn btn-primary" on:click={handleNewTask}>+ New task</button>
  </div>
</header>

<div class="board-area">
  <div class="today-list">
    <div class="filter-bar">
      <button class="filter-pill" class:active={$todayFilter === 'all'}
        on:click={() => todayFilter.set('all')}>All ({todayCards.length})</button>
      <button class="filter-pill" class:active={$todayFilter === 'blocked'}
        on:click={() => todayFilter.set('blocked')}>Waiting on ({blocked.length})</button>
    </div>

    {#if $todayFilter === 'all'}
      {#if overdue.length}
        <div class="today-section">
          <div class="today-section-label">
            Overdue <span class="count">{overdue.length}</span>
          </div>
          {#each overdue as card (card.id)}
            {@const board = getBoard(card.board_id)}
            {@const stale = isWaitingStale(card)}
            {@const overdueDays = daysBetween(card.due_date, todayISO())}
            <div
              class="today-card"
              class:overdue={true}
              class:waiting={!!card.waiting_on}
              on:click={() => editingCardId.set(card.id)}
              role="button"
              tabindex="0"
              on:keydown={e => e.key === 'Enter' && editingCardId.set(card.id)}
            >
              <div class="check" class:done={card.column === 'done'}
                on:click={e => handleCheck(e, card.id)}
                role="checkbox" aria-checked={card.column === 'done'} tabindex="0"
                on:keydown={e => e.key === ' ' && handleCheck(e, card.id)}></div>
              <div class="title">
                {card.title}
                {#if card.recurrence || card.template_id}
                  <span class="recur">↻ recurring</span>
                {/if}
              </div>
              <div class="meta">
                {#if card.waiting_on}
                  <span class="pause-icon" class:stale title="Waiting on {card.waiting_on.text}">❚❚</span>
                {/if}
                <span class="overdue-tag">{overdueDays}d overdue</span>
                {#if board}
                  <span class="pill pill-link" on:click={e => navigateToBoard(e, card.board_id)} role="button" tabindex="0" on:keydown={e => e.key === 'Enter' && navigateToBoard(e, card.board_id)}>
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: {board.color}; display: inline-block;"></span>
                    {getBoardLabel(card.board_id)}
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if dueToday.length}
        <div class="today-section">
          <div class="today-section-label">
            Due today <span class="count">{dueToday.length}</span>
          </div>
          {#each dueToday as card (card.id)}
            {@const board = getBoard(card.board_id)}
            {@const stale = isWaitingStale(card)}
            <div
              class="today-card"
              class:waiting={!!card.waiting_on}
              on:click={() => editingCardId.set(card.id)}
              role="button"
              tabindex="0"
              on:keydown={e => e.key === 'Enter' && editingCardId.set(card.id)}
            >
              <div class="check" class:done={card.column === 'done'}
                on:click={e => handleCheck(e, card.id)}
                role="checkbox" aria-checked={card.column === 'done'} tabindex="0"
                on:keydown={e => e.key === ' ' && handleCheck(e, card.id)}></div>
              <div class="title">
                {card.title}
                {#if card.recurrence || card.template_id}
                  <span class="recur">↻ recurring</span>
                {/if}
              </div>
              <div class="meta">
                {#if card.waiting_on}
                  <span class="pause-icon" class:stale title="Waiting on {card.waiting_on.text}">❚❚</span>
                {/if}
                {#if board}
                  <span class="pill pill-link" on:click={e => navigateToBoard(e, card.board_id)} role="button" tabindex="0" on:keydown={e => e.key === 'Enter' && navigateToBoard(e, card.board_id)}>
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: {board.color}; display: inline-block;"></span>
                    {getBoardLabel(card.board_id)}
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if todayCards.length === 0 && inProgressCards.length === 0}
        <div class="empty">A clear day. Nothing due.</div>
      {/if}

      {#if inProgressCards.length}
        <div class="today-section">
          <div class="today-section-label">
            In progress <span class="count">{inProgressCards.length}</span>
          </div>
          {#each inProgressCards as card (card.id)}
            {@const board = getBoard(card.board_id)}
            {@const stale = isWaitingStale(card)}
            <div
              class="today-card in-progress"
              class:waiting={!!card.waiting_on}
              on:click={() => editingCardId.set(card.id)}
              role="button"
              tabindex="0"
              on:keydown={e => e.key === 'Enter' && editingCardId.set(card.id)}
            >
              <div class="check in-progress-dot" title="In Progress"></div>
              <div class="title">
                {card.title}
                {#if card.recurrence || card.template_id}
                  <span class="recur">↻ recurring</span>
                {/if}
              </div>
              <div class="meta">
                {#if card.waiting_on}
                  <span class="pause-icon" class:stale title="Waiting on {card.waiting_on.text}">❚❚</span>
                {/if}
                {#if board}
                  <span class="pill pill-link" on:click={e => navigateToBoard(e, card.board_id)} role="button" tabindex="0" on:keydown={e => e.key === 'Enter' && navigateToBoard(e, card.board_id)}>
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: {board.color}; display: inline-block;"></span>
                    {getBoardLabel(card.board_id)}
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if subtasksDueToday.length}
        <div class="today-section">
          <div class="today-section-label">
            Subtasks due <span class="count">{subtasksDueToday.length}</span>
          </div>
          {#each subtasksDueToday as sub (sub.id)}
            {@const board = getBoard(sub.parentCard.board_id)}
            {@const subOverdue = sub.due_date < todayISO()}
            <div
              class="today-card subtask-card"
              class:overdue={subOverdue}
              on:click={() => editingCardId.set(sub.parentCard.id)}
              role="button"
              tabindex="0"
              on:keydown={e => e.key === 'Enter' && editingCardId.set(sub.parentCard.id)}
            >
              <div class="check" class:done={sub.done}
                on:click={e => { e.stopPropagation(); toggleSubtaskDone(sub.parentCard.id, sub.id); }}
                role="checkbox" aria-checked={sub.done} tabindex="0"
                on:keydown={e => e.key === ' ' && (e.stopPropagation(), toggleSubtaskDone(sub.parentCard.id, sub.id))}></div>
              <div class="subtask-card-body">
                <div class="title">{sub.text}</div>
                <div class="subtask-parent-label">↳ {sub.parentCard.title}</div>
              </div>
              <div class="meta">
                {#if subOverdue}
                  <span class="overdue-tag">{daysBetween(sub.due_date, todayISO())}d overdue</span>
                {/if}
                {#if board}
                  <span class="pill pill-link" on:click={e => navigateToBoard(e, sub.parentCard.board_id)} role="button" tabindex="0" on:keydown={e => e.key === 'Enter' && navigateToBoard(e, sub.parentCard.board_id)}>
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: {board.color}; display: inline-block;"></span>
                    {getBoardLabel(sub.parentCard.board_id)}
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if upNext.length}
        <div class="today-section" style="opacity: 0.7;">
          <div class="today-section-label">
            Up next — tomorrow <span class="count">{upNext.length}</span>
          </div>
          {#each upNext as card (card.id)}
            {@const board = getBoard(card.board_id)}
            <div
              class="today-card"
              on:click={() => editingCardId.set(card.id)}
              role="button"
              tabindex="0"
              on:keydown={e => e.key === 'Enter' && editingCardId.set(card.id)}
            >
              <div class="check"></div>
              <div class="title">{card.title}</div>
              <div class="meta">
                {#if board}
                  <span class="pill pill-link" on:click={e => navigateToBoard(e, card.board_id)} role="button" tabindex="0" on:keydown={e => e.key === 'Enter' && navigateToBoard(e, card.board_id)}>
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: {board.color}; display: inline-block;"></span>
                    {getBoardLabel(card.board_id)}
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}

    {:else}
      <!-- Waiting on filter -->
      {#if visible.length === 0}
        <div class="empty">Nothing waiting on anyone.</div>
      {:else}
        <div class="today-section">
          {#each visible as card (card.id)}
            {@const board = getBoard(card.board_id)}
            {@const stale = isWaitingStale(card)}
            {@const over = isOverdue(card)}
            {@const overdueDays = over ? daysBetween(card.due_date, todayISO()) : 0}
            <div
              class="today-card"
              class:overdue={over}
              class:waiting={!!card.waiting_on}
              on:click={() => editingCardId.set(card.id)}
              role="button"
              tabindex="0"
              on:keydown={e => e.key === 'Enter' && editingCardId.set(card.id)}
            >
              <div class="check" class:done={card.column === 'done'}
                on:click={e => handleCheck(e, card.id)}
                role="checkbox" aria-checked={card.column === 'done'} tabindex="0"
                on:keydown={e => e.key === ' ' && handleCheck(e, card.id)}></div>
              <div class="title">{card.title}</div>
              <div class="meta">
                {#if card.waiting_on}
                  <span class="pause-icon" class:stale title="Waiting on {card.waiting_on.text}">❚❚</span>
                {/if}
                {#if over}<span class="overdue-tag">{overdueDays}d overdue</span>{/if}
                {#if board}
                  <span class="pill pill-link" on:click={e => navigateToBoard(e, card.board_id)} role="button" tabindex="0" on:keydown={e => e.key === 'Enter' && navigateToBoard(e, card.board_id)}>
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: {board.color}; display: inline-block;"></span>
                    {getBoardLabel(card.board_id)}
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .main-header {
    padding: 24px 32px 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 1px solid var(--line);
  }
  .main-title {
    font-family: var(--serif);
    font-size: 32px;
    font-weight: 500;
    letter-spacing: -0.8px;
    line-height: 1;
  }
  .em { font-style: italic; color: var(--accent); }
  .date-sub { color: var(--ink-3); font-style: normal; font-weight: 400; font-size: 18px; letter-spacing: 0; }
  .main-subtitle { font-size: 12px; color: var(--ink-3); margin-top: 6px; letter-spacing: 0.2px; }
  .header-actions { display: flex; gap: 8px; }

  .board-area { flex: 1; overflow: hidden; padding: 20px 32px 32px; }
  .today-list { max-width: 720px; height: 100%; overflow-y: auto; padding-right: 8px; }
  .today-section { margin-bottom: 24px; }
  .today-section-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--ink-3);
    margin-bottom: 10px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .count { background: var(--surface-2); color: var(--ink-2); padding: 1px 7px; border-radius: 10px; font-size: 10px; letter-spacing: 0.5px; }

  .today-card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: border-color 0.1s;
    position: relative;
  }
  .today-card:hover { border-color: var(--line-strong); }
  .today-card.overdue { border-left: 3px solid var(--coral); }
  .today-card.waiting { border-left: 3px solid var(--amber); }
  .today-card.overdue.waiting { border-left: 3px solid var(--coral); }
  .today-card.in-progress { border-left: 3px solid var(--accent); }
  .in-progress-dot {
    background: var(--accent);
    border-color: var(--accent);
    cursor: default;
  }
  .in-progress-dot::after {
    content: '';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 6px; height: 6px;
    border-radius: 50%;
    background: white;
  }

  .check {
    width: 18px; height: 18px;
    border-radius: 50%;
    border: 1.5px solid var(--line-strong);
    flex-shrink: 0;
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
    position: relative;
  }
  .check:hover { border-color: var(--accent); }
  .check.done { background: var(--green); border-color: var(--green); }
  .check.done::after {
    content: '';
    position: absolute;
    top: 4px; left: 5px;
    width: 4px; height: 8px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
  }

  .title { flex: 1; font-size: 14px; color: var(--ink); }
  .recur { color: var(--accent); font-size: 11px; margin-left: 6px; font-style: italic; font-family: var(--serif); }
  .meta { display: flex; align-items: center; gap: 8px; }
  .pause-icon { color: var(--amber); font-size: 13px; line-height: 1; }
  .pause-icon.stale { color: var(--coral); }
  .pill {
    font-size: 10px; padding: 2px 8px; border-radius: 10px;
    background: var(--surface-2); color: var(--ink-2); letter-spacing: 0.3px;
    display: inline-flex; align-items: center; gap: 5px;
  }
  .overdue-tag { font-size: 10px; color: var(--coral); font-weight: 500; letter-spacing: 0.3px; }
  .pill-link { cursor: pointer; }
  .pill-link:hover { background: var(--line-strong); color: var(--ink); }
  .subtask-card { align-items: flex-start; }
  .subtask-card-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .subtask-parent-label { font-size: 11px; color: var(--ink-3); }

  @media (max-width: 768px) {
    .main-header { padding: 16px 18px 12px; flex-direction: column; align-items: flex-start; gap: 10px; }
    .main-title { font-size: 24px; }
    .header-actions { width: 100%; }
    .board-area { padding: 12px 18px 18px; overflow: visible; }
    .today-list { height: auto; overflow: visible; padding-right: 0; max-width: 100%; }
  }
</style>
