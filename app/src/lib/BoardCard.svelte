<script>
  import { createEventDispatcher } from 'svelte';
  import { editingCardId } from './store.js';
  import { isOverdue, isWaitingStale, formatDateRel, todayISO } from './logic.js';

  export let card;

  const dispatch = createEventDispatcher();

  $: overdue = isOverdue(card);
  $: stale = isWaitingStale(card);
  $: dueLabel = formatDateRel(card.due_date);
  $: dueClass = !card.due_date ? '' : (overdue ? 'overdue' : (card.due_date === todayISO() ? 'today' : ''));
  $: donedCount = card.subtasks?.filter(s => s.done).length ?? 0;
  $: totalSubs = card.subtasks?.length ?? 0;
  $: overdueSubCount = card.subtasks?.filter(s => !s.done && s.due_date && s.due_date < todayISO()).length ?? 0;

  function onDragStart(e) {
    dispatch('dragstart', e);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
  }
  function onDragEnd(e) {
    dispatch('dragend', e);
    e.currentTarget.classList.remove('dragging');
  }
</script>

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
</style>
