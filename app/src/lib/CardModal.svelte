<script>
  import { cards, boards, editingCardId, updateCard, deleteCard, markCardDone, reopenCard, moveCard } from './store.js';
  import { effectiveColumn, isWaitingStale, waitingDays, todayISO, tomorrowISO, uid } from './logic.js';
  import { COLUMN_NAMES } from './logic.js';

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  $: card = $cards.find(c => c.id === $editingCardId) ?? null;
  $: board = card ? $boards.find(b => b.id === card.board_id) : null;
  $: effCol = card ? effectiveColumn(card) : 'todo';
  $: stale = card ? isWaitingStale(card) : false;
  $: waitDays = card ? waitingDays(card) : 0;
  $: recurrence = card?.recurrence ?? { freq: 'none', days: [] };

  function close() {
    if (card && !card.title.trim()) {
      deleteCard(card.id);
    }
    editingCardId.set(null);
  }

  function onTitle(e) {
    updateCard(card.id, { title: e.target.value });
  }
  function onNotes(e) {
    updateCard(card.id, { notes: e.target.value });
  }
  function onDue(e) {
    updateCard(card.id, { due_date: e.target.value || null });
  }
  function onBoard(e) {
    updateCard(card.id, { board_id: e.target.value });
  }
  function onWaiting(e) {
    const txt = e.target.value.trim();
    if (txt) {
      const existing = card.waiting_on;
      updateCard(card.id, {
        waiting_on: existing ? { ...existing, text: txt } : { text: txt, since: todayISO() }
      });
    } else {
      updateCard(card.id, { waiting_on: null });
    }
  }

  // Recurrence
  function onRecurFreq(e) {
    const freq = e.target.value;
    if (freq === 'none') {
      updateCard(card.id, { recurrence: null });
    } else {
      const existing = card.recurrence;
      updateCard(card.id, {
        recurrence: { freq, days: existing?.days?.length ? existing.days : [new Date().getDay()] }
      });
    }
  }
  function toggleDay(d) {
    const rec = card.recurrence || { freq: 'weekly', days: [] };
    const days = [...(rec.days || [])];
    const idx = days.indexOf(d);
    if (idx >= 0) days.splice(idx, 1); else days.push(d);
    updateCard(card.id, { recurrence: { ...rec, days } });
  }

  // Subtasks
  function toggleSubtask(id) {
    const subs = card.subtasks.map(s => s.id === id ? { ...s, done: !s.done } : s);
    updateCard(card.id, { subtasks: subs });
  }
  function updateSubtaskText(id, text) {
    const subs = card.subtasks.map(s => s.id === id ? { ...s, text } : s);
    updateCard(card.id, { subtasks: subs });
  }
  function addSubtask() {
    const subs = [...card.subtasks, { id: uid(), text: '', done: false }];
    updateCard(card.id, { subtasks: subs });
    // Focus new input after next tick
    setTimeout(() => {
      const inputs = document.querySelectorAll('.subtask-text');
      inputs[inputs.length - 1]?.focus();
    }, 0);
  }
  function removeSubtask(id) {
    updateCard(card.id, { subtasks: card.subtasks.filter(s => s.id !== id) });
  }
  function updateSubtaskDue(id, date) {
    const subs = card.subtasks.map(s => s.id === id ? { ...s, due_date: date || null } : s);
    updateCard(card.id, { subtasks: subs });
  }

  // Actions
  function onMarkDone() {
    markCardDone(card.id);
    editingCardId.set(null);
  }
  function onReopen() {
    reopenCard(card.id);
    editingCardId.set(null);
  }
  function onMoveProgress() {
    moveCard(card.id, 'progress');
    editingCardId.set(null);
  }
  function onDelete() {
    if (!confirm('Delete this task?')) return;
    deleteCard(card.id);
    editingCardId.set(null);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if card && board}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-overlay" on:click|self={close}>
    <div class="modal">
      <div class="modal-header">
        <div class="modal-board-tag">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: {board.color}; display: inline-block;"></span>
          <select class="field-select" style="border: none; background: transparent; padding: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; cursor: pointer; color: var(--ink-3);"
            value={card.board_id} on:change={onBoard}>
            {#each $boards.filter(b => !b.archived) as b (b.id)}
              <option value={b.id}>{b.name}</option>
            {/each}
          </select>
          <span style="margin: 0 4px; color: var(--ink-3);">·</span>
          <span style="font-size: 11px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.3px;">{COLUMN_NAMES[effCol]}</span>
        </div>
        <button class="modal-close" on:click={close}>×</button>
      </div>

      <div class="modal-body">
        <!-- svelte-ignore a11y-autofocus -->
        <input
          class="modal-title-input"
          placeholder="Task name…"
          value={card.title}
          on:input={onTitle}
          autofocus
        />

        <div class="field">
          <div class="field-label">Notes</div>
          <textarea class="field-textarea" placeholder="Add detail, context, links…"
            value={card.notes || ''} on:input={onNotes}></textarea>
        </div>

        <div class="field-row">
          <div class="field">
            <div class="field-label">Due date</div>
            <input type="date" class="field-input" value={card.due_date || ''} on:change={onDue}>
          </div>
          <div class="field">
            <div class="field-label">Recurrence</div>
            <select class="field-select" value={recurrence.freq ?? 'none'} on:change={onRecurFreq}>
              <option value="none">None</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        {#if recurrence.freq === 'weekly'}
          <div class="field">
            <div class="field-label">On these days</div>
            <div class="recurrence-row">
              {#each DAY_NAMES as day, i}
                <button
                  class="day-pill"
                  class:selected={recurrence.days?.includes(i)}
                  on:click={() => toggleDay(i)}
                >{day}</button>
              {/each}
            </div>
          </div>
        {/if}

        <div class="field">
          <div class="field-label">
            Waiting on
            <span style="text-transform: none; letter-spacing: 0; font-weight: 400; color: var(--ink-3);">— blocker, person, dependency</span>
          </div>
          <input
            class="field-input"
            placeholder="e.g., Sarah from legal, procurement approval…"
            value={card.waiting_on?.text || ''}
            on:input={onWaiting}
          />
          {#if card.waiting_on}
            <div class="waiting-since" class:stale>
              Waiting {waitDays} day{waitDays === 1 ? '' : 's'}{stale ? ' — getting stale' : ''}
            </div>
          {/if}
        </div>

        <div class="field">
          <div class="field-label">
            Subtasks
            {#if card.subtasks.length}
              <span style="color: var(--ink-3); font-weight: 400; letter-spacing: 0; text-transform: none;">
                {card.subtasks.filter(s => s.done).length} of {card.subtasks.length}
              </span>
            {/if}
          </div>
          {#each card.subtasks as sub (sub.id)}
            {@const subOverdue = !sub.done && !!sub.due_date && sub.due_date < todayISO()}
            <div class="subtask">
              <div class="subtask-check" class:done={sub.done} on:click={() => toggleSubtask(sub.id)} role="checkbox" aria-checked={sub.done} tabindex="0" on:keydown={e => e.key === ' ' && toggleSubtask(sub.id)}></div>
              <input
                class="subtask-text"
                class:done={sub.done}
                value={sub.text}
                on:input={e => updateSubtaskText(sub.id, e.target.value)}
                on:keydown={e => e.key === 'Enter' && addSubtask()}
              />
              <input
                type="date"
                class="subtask-due"
                class:has-date={!!sub.due_date}
                class:overdue={subOverdue}
                value={sub.due_date || ''}
                on:change={e => updateSubtaskDue(sub.id, e.target.value)}
                title={sub.due_date ? (subOverdue ? 'Overdue' : 'Due date') : 'Set due date'}
              />
              <button class="subtask-delete" on:click={() => removeSubtask(sub.id)}>×</button>
            </div>
          {/each}
          <div class="add-subtask" on:click={addSubtask} role="button" tabindex="0" on:keydown={e => e.key === 'Enter' && addSubtask()}>+ Add subtask</div>
        </div>

        <div class="modal-actions">
          {#if card.column === 'done'}
            <button class="btn" on:click={onReopen}>Reopen</button>
          {:else}
            <button class="btn" on:click={onMoveProgress} disabled={effCol === 'progress'}>
              {effCol === 'progress' ? '✓ In Progress' : 'Move to In Progress'}
            </button>
            <button class="btn btn-primary" on:click={onMarkDone}>Mark Complete</button>
          {/if}
          <button class="btn-danger" style="margin-left: auto;" on:click={onDelete}>Delete</button>
        </div>
      </div>
    </div>
  </div>
{/if}
