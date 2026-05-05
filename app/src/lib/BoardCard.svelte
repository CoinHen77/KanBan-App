<script>
  import { createEventDispatcher } from 'svelte';
  import { editingCardId, boards, updateCard } from './store.js';
  import { isOverdue, isWaitingStale, formatDateRel, todayISO } from './logic.js';

  export let card;

  const dispatch = createEventDispatcher();

  let showMoveTo = false;

  $: overdue = isOverdue(card);
  $: stale = isWaitingStale(card);
  $: dueLabel = formatDateRel(card.due_date);
  $: dueClass = !card.due_date ? '' : (overdue ? 'overdue' : (card.due_date === todayISO() ? 'today' : ''));
  $: donedCount = card.subtasks?.filter(s => s.done).length ?? 0;
  $: totalSubs = card.subtasks?.length ?? 0;
  $: overdueSubCount = card.subtasks?.filter(s => !s.done && s.due_date && s.due_date < todayISO()).length ?? 0;
  $: otherBoards = $boards.filter(b => !b.archived && b.id !== card.board_id);

  function onDragStart(e) {
    dispatch('dragstart', e);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
  }
  function onDragEnd(e) {
    dispatch('dragend', e);
    e.currentTarget.classList.remove('dragging');
  }

  function moveTo(boardId) {
    updateCard(card.id, { board_id: boardId });
    showMoveTo = false;
  }

  function onWindowClick() {
    if (showMoveTo) showMoveTo = false;
  }
</script>

<svelte:window on:click={onWindowClick} />

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="card"
  class:waiting={!!card.waiting_on && !stale}
  class:stale={!!card.waiting_on && stale}
  class:overdue={overdue}
  class:done={card.column === 'done'}
  draggable="true"
  on:dragstart={onDragStart}
  on:dragend={onDragEnd}
  on:click={() => editingCardId.set(card.id)}
  on:keydown={e => e.key === 'Enter' && editingCardId.set(card.id)}
  tabindex="0"
  title={card.waiting_on ? `Waiting on ${card.waiting_on.text}` : undefined}
>
  <div class="card-title">{card.title}</div>
  <div class="card-meta">
    {#if dueLabel}
      <span class="card-due {dueClass}">{dueLabel}</span>
    {/if}
    {#if totalSubs}
      <span class="card-subtask-meta" class:subtask-overdue={overdueSubCount > 0}>
        {donedCount}/{totalSubs}{overdueSubCount ? ` · ${overdueSubCount} overdue` : ''}
      </span>
    {/if}
    {#if card.recurrence || card.template_id}
      <span class="card-recur-icon">↻</span>
    {/if}
    {#if card.waiting_on}
      <span class="card-pause-icon" class:stale>{stale ? '❚❚' : '❚❚'}</span>
    {/if}
  </div>

  {#if otherBoards.length > 0}
    <div class="card-actions">
      <div class="move-wrap">
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <button class="move-btn" on:click|stopPropagation={() => showMoveTo = !showMoveTo} title="Move to board">→</button>
        {#if showMoveTo}
          <div class="move-menu">
            {#each otherBoards as b (b.id)}
              <!-- svelte-ignore a11y-click-events-have-key-events -->
              <div class="move-option" on:click|stopPropagation={() => moveTo(b.id)}>
                <span class="move-dot" style="background:{b.color}"></span>
                {b.name}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .card {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 6px;
    cursor: pointer;
    transition: border-color 0.1s;
    position: relative;
  }
  .card:hover { border-color: var(--line-strong); }
  :global(.card.dragging) { opacity: 0.4; }
  .card.waiting { border-left: 2px solid var(--amber); }
  .card.stale { border-left: 2px solid var(--coral); }
  .card.overdue { border-left: 2px solid var(--coral); }
  .card.done .card-title { color: var(--ink-3); text-decoration: line-through; }
  .card-title { font-size: 13px; line-height: 1.4; margin-bottom: 4px; }
  .card-meta { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 11px; color: var(--ink-3); }
  .card-due { color: var(--ink-3); }
  .card-due.overdue { color: var(--coral); font-weight: 500; }
  .card-due.today { color: var(--accent); font-weight: 500; }
  .card-recur-icon { font-family: var(--serif); font-style: italic; color: var(--accent); font-size: 11px; }
  .card-pause-icon { color: var(--amber); margin-left: auto; font-size: 11px; }
  .card-pause-icon.stale { color: var(--coral); }
  .card-subtask-meta { color: var(--ink-3); font-size: 10px; }
  .card-subtask-meta.subtask-overdue { color: var(--coral); font-weight: 500; }

  .card-actions {
    display: none;
    position: absolute;
    top: 7px;
    right: 8px;
  }
  .card:hover .card-actions { display: flex; }

  .move-wrap { position: relative; }
  .move-btn {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 1px 6px;
    font-size: 12px;
    cursor: pointer;
    color: var(--ink-3);
    line-height: 1.6;
  }
  .move-btn:hover { color: var(--ink); border-color: var(--line-strong); }

  .move-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    z-index: 200;
    min-width: 150px;
    padding: 4px;
  }
  .move-option {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    color: var(--ink-2);
  }
  .move-option:hover { background: var(--surface-2); color: var(--ink); }
  .move-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
</style>
