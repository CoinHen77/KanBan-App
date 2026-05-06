<script>
  import { cards, boards, currentView, currentBoardId, editingCardId } from './store.js';
  import { isWaitingStale, waitingDays, todayISO, formatDateLong } from './logic.js';

  $: waitingCards = $cards.filter(c => c.column !== 'done' && c.waiting_on);
  $: stale = waitingCards.filter(c => isWaitingStale(c))
    .sort((a, b) => waitingDays(b) - waitingDays(a));
  $: active = waitingCards.filter(c => !isWaitingStale(c))
    .sort((a, b) => waitingDays(b) - waitingDays(a));

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
</script>

<header class="main-header">
  <div>
    <h1 class="main-title">
      <span class="em">Waiting On</span>
    </h1>
    <div class="main-subtitle">
      {waitingCards.length} blocker{waitingCards.length === 1 ? '' : 's'}{stale.length ? ` · ${stale.length} stale` : ''}
    </div>
  </div>
</header>

<div class="board-area">
  <div class="waiting-list">

    {#if waitingCards.length === 0}
      <div class="empty">Nothing waiting on anyone.</div>
    {/if}

    {#if stale.length}
      <div class="today-section">
        <div class="today-section-label">
          Stale — 14+ days <span class="count">{stale.length}</span>
        </div>
        {#each stale as card (card.id)}
          {@const board = getBoard(card.board_id)}
          {@const days = waitingDays(card)}
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="waiting-card stale"
            on:click={() => editingCardId.set(card.id)}
            role="button"
            tabindex="0"
            on:keydown={e => e.key === 'Enter' && editingCardId.set(card.id)}
          >
            <div class="pause-col">
              <span class="pause-icon stale">❚❚</span>
            </div>
            <div class="waiting-body">
              <div class="title">{card.title}</div>
              <div class="waiting-detail">Waiting on <strong>{card.waiting_on.text}</strong></div>
            </div>
            <div class="meta">
              <span class="days-badge stale">{days}d</span>
              {#if board}
                <span class="pill pill-link" on:click={e => navigateToBoard(e, card.board_id)} role="button" tabindex="0" on:keydown={e => e.key === 'Enter' && navigateToBoard(e, card.board_id)}>
                  <span style="width:6px;height:6px;border-radius:50%;background:{board.color};display:inline-block;"></span>
                  {getBoardLabel(card.board_id)}
                </span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#if active.length}
      <div class="today-section">
        <div class="today-section-label">
          Waiting <span class="count">{active.length}</span>
        </div>
        {#each active as card (card.id)}
          {@const board = getBoard(card.board_id)}
          {@const days = waitingDays(card)}
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="waiting-card"
            on:click={() => editingCardId.set(card.id)}
            role="button"
            tabindex="0"
            on:keydown={e => e.key === 'Enter' && editingCardId.set(card.id)}
          >
            <div class="pause-col">
              <span class="pause-icon">❚❚</span>
            </div>
            <div class="waiting-body">
              <div class="title">{card.title}</div>
              <div class="waiting-detail">Waiting on <strong>{card.waiting_on.text}</strong></div>
            </div>
            <div class="meta">
              <span class="days-badge">{days}d</span>
              {#if board}
                <span class="pill pill-link" on:click={e => navigateToBoard(e, card.board_id)} role="button" tabindex="0" on:keydown={e => e.key === 'Enter' && navigateToBoard(e, card.board_id)}>
                  <span style="width:6px;height:6px;border-radius:50%;background:{board.color};display:inline-block;"></span>
                  {getBoardLabel(card.board_id)}
                </span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
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
  .main-title { font-family: var(--serif); font-size: 32px; font-weight: 500; letter-spacing: -0.8px; line-height: 1; }
  .em { font-style: italic; color: var(--amber); }
  .main-subtitle { font-size: 12px; color: var(--ink-3); margin-top: 6px; letter-spacing: 0.2px; }

  .board-area { flex: 1; overflow: hidden; padding: 20px 32px 32px; }
  .waiting-list { max-width: 720px; height: 100%; overflow-y: auto; padding-right: 8px; }

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

  .waiting-card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-left: 3px solid var(--amber);
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: border-color 0.1s;
  }
  .waiting-card:hover { border-color: var(--amber); }
  .waiting-card.stale { border-left-color: var(--coral); }
  .waiting-card.stale:hover { border-color: var(--coral); }

  .pause-col { flex-shrink: 0; width: 20px; display: flex; justify-content: center; }
  .pause-icon { color: var(--amber); font-size: 14px; line-height: 1; }
  .pause-icon.stale { color: var(--coral); }

  .waiting-body { flex: 1; min-width: 0; }
  .title { font-size: 14px; color: var(--ink); margin-bottom: 3px; }
  .waiting-detail { font-size: 12px; color: var(--ink-3); }
  .waiting-detail strong { color: var(--ink-2); font-weight: 500; }

  .meta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .days-badge {
    font-size: 11px;
    font-weight: 500;
    color: var(--amber);
    background: var(--surface-2);
    padding: 2px 7px;
    border-radius: 8px;
    letter-spacing: 0.3px;
  }
  .days-badge.stale { color: var(--coral); }

  .pill {
    font-size: 10px; padding: 2px 8px; border-radius: 10px;
    background: var(--surface-2); color: var(--ink-2); letter-spacing: 0.3px;
    display: inline-flex; align-items: center; gap: 5px;
  }
  .pill-link { cursor: pointer; }
  .pill-link:hover { background: var(--line-strong); color: var(--ink); }

  .empty { padding: 48px 0; color: var(--ink-3); font-size: 14px; text-align: center; font-style: italic; font-family: var(--serif); }

  @media (max-width: 768px) {
    .main-header { padding: 16px 18px 12px; }
    .main-title { font-size: 24px; }
    .board-area { padding: 12px 18px 18px; overflow: visible; }
    .waiting-list { height: auto; overflow: visible; padding-right: 0; max-width: 100%; }
  }
</style>
