<script>
  import { onMount } from 'svelte';
  import '../app.css';
  import { boards, cards, currentView, currentBoardId, todayCount, waitingCount, appLoading, editingCardId, showPairingModal, showBoardModal, editingBoardId, createBoard, updateBoard, archiveBoard, currentAuthUid, currentUserId, currentUser, signInWithGoogle, signOutUser, createCard } from '$lib/store.js';
  import { BOARD_COLORS, effectiveColumn } from '$lib/logic.js';

  let isOnline = true;

  onMount(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .catch(e => console.error('SW registration failed:', e));
    }
    isOnline = navigator.onLine;
  });

  let newBoardName = '';
  let newBoardColor = BOARD_COLORS[0];
  let newBoardParentId = null;

  // Track which parent workflows are collapsed
  let collapsedIds = new Set();

  function toggleCollapse(id) {
    if (collapsedIds.has(id)) {
      collapsedIds.delete(id);
    } else {
      collapsedIds.add(id);
    }
    collapsedIds = collapsedIds;
  }

  // Auto-expand parent when its child becomes active
  $: {
    const active = $boards.find(b => b.id === $currentBoardId);
    if (active?.parent_id && collapsedIds.has(active.parent_id)) {
      collapsedIds.delete(active.parent_id);
      collapsedIds = collapsedIds;
    }
  }

  function pickColor() {
    const used = $boards.map(b => b.color);
    return BOARD_COLORS.find(c => !used.includes(c)) || BOARD_COLORS[$boards.length % BOARD_COLORS.length];
  }

  function openNewBoard() {
    newBoardName = '';
    newBoardColor = pickColor();
    newBoardParentId = null;
    editingBoardId.set(null);
    showBoardModal.set(true);
  }

  function openNewSubBoard(parentId) {
    newBoardName = '';
    newBoardColor = pickColor();
    newBoardParentId = parentId;
    editingBoardId.set(null);
    showBoardModal.set(true);
  }

  function openEditBoard(id) {
    const b = $boards.find(b => b.id === id);
    if (!b) return;
    newBoardName = b.name;
    newBoardColor = b.color;
    newBoardParentId = b.parent_id || null;
    editingBoardId.set(id);
    showBoardModal.set(true);
  }

  function saveBoardModal() {
    if (!newBoardName.trim()) return;
    if ($editingBoardId) {
      updateBoard($editingBoardId, { name: newBoardName.trim(), color: newBoardColor });
    } else {
      createBoard(newBoardName, newBoardColor, newBoardParentId);
    }
    showBoardModal.set(false);
  }

  function setView(view, boardId = null) {
    currentView.set(view);
    currentBoardId.set(boardId);
  }

  function getBoardCardCount(boardId) {
    return $cards.filter(c => c.board_id === boardId && c.column !== 'done').length;
  }

  function getWorkflowCardCount(parentId) {
    const childIds = $boards.filter(b => b.parent_id === parentId).map(b => b.id);
    return $cards.filter(c =>
      (childIds.includes(c.board_id) || c.board_id === parentId) && c.column !== 'done'
    ).length;
  }

  $: activeBoards = $boards.filter(b => !b.archived);
  $: parentBoards = activeBoards.filter(b => !b.parent_id);
  $: archivedBoards = $boards.filter(b => b.archived);

  let showArchived = false;

  function getChildren(parentId) {
    return activeBoards.filter(b => b.parent_id === parentId);
  }

  $: isLinked = $currentAuthUid && $currentUserId && $currentAuthUid !== $currentUserId;

  $: modalTitle = $editingBoardId
    ? (newBoardParentId ? 'Edit sub-board' : 'Edit workflow')
    : (newBoardParentId ? 'New sub-board' : 'New workflow');

  let showShortcuts = false;

  function handleGlobalKeydown(e) {
    const tag = document.activeElement?.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (document.activeElement?.isContentEditable) return;
    if ($editingCardId) return; // CardModal handles its own Escape

    if (e.key === 'Escape') {
      if ($showBoardModal) { showBoardModal.set(false); return; }
      if ($showPairingModal) { showPairingModal.set(false); return; }
      if (showShortcuts) { showShortcuts = false; return; }
    } else if (e.key === '?') {
      showShortcuts = !showShortcuts;
    } else if (e.key === 't' || e.key === 'T') {
      setView('today');
    } else if (e.key === 'w' || e.key === 'W') {
      setView('waiting');
    } else if (e.key === 'n' || e.key === 'N') {
      const board = ($currentView === 'board' && $currentBoardId)
        ? $boards.find(b => b.id === $currentBoardId)
        : $boards.filter(b => !b.archived)[0];
      if (board) createCard(board.id);
    }
  }
</script>

<svelte:window on:online={() => isOnline = true} on:offline={() => isOnline = false} on:keydown={handleGlobalKeydown} />

{#if !isOnline}
  <div class="offline-banner">Offline — changes will sync when reconnected</div>
{/if}

<div class="app">
  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="logo">Tasks</div>
      <div class="sync-status">
        <span class="sync-dot" class:synced={isLinked}></span>{isLinked ? 'Synced' : 'Local'}
      </div>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-label">Views</div>
      <div
        class="nav-item"
        class:active={$currentView === 'today'}
        on:click={() => setView('today')}
        on:keydown={e => e.key === 'Enter' && setView('today')}
        role="button"
        tabindex="0"
      >
        <span class="star">★</span>
        <span>Today</span>
        <span class="nav-count" class:accent={$currentView === 'today'}>{$todayCount}</span>
      </div>
      <div
        class="nav-item"
        class:active={$currentView === 'waiting'}
        on:click={() => setView('waiting')}
        on:keydown={e => e.key === 'Enter' && setView('waiting')}
        role="button"
        tabindex="0"
      >
        <span class="star" style="color: var(--amber);">❚❚</span>
        <span>Waiting On</span>
        {#if $waitingCount > 0}
          <span class="nav-count" class:accent={$currentView === 'waiting'}>{$waitingCount}</span>
        {/if}
      </div>
    </div>

    <div class="sidebar-section">
      <div class="sidebar-label">Workflows</div>

      {#each parentBoards as parent (parent.id)}
        {@const children = getChildren(parent.id)}
        {@const hasChildren = children.length > 0}
        {@const isCollapsed = collapsedIds.has(parent.id)}

        <div class="workflow-group">
          <!-- Parent row -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            class="nav-item workflow-parent"
            class:active={$currentView === 'board' && $currentBoardId === parent.id}
            on:click={() => setView('board', parent.id)}
            on:keydown={e => e.key === 'Enter' && setView('board', parent.id)}
            role="button"
            tabindex="0"
          >
            {#if hasChildren}
              <button class="chevron-btn" on:click|stopPropagation={() => toggleCollapse(parent.id)} tabindex="-1" aria-label="Toggle">
                <span class="chevron" class:collapsed={isCollapsed}>▾</span>
              </button>
            {/if}
            <span class="board-dot" style="background: {parent.color}"></span>
            <span class="board-name-text">{parent.name}</span>
            <button class="board-rename-btn" on:click|stopPropagation={() => openNewSubBoard(parent.id)} title="Add sub-board">+</button>
            <button class="board-rename-btn" on:click|stopPropagation={() => openEditBoard(parent.id)} title="Edit">✎</button>
            <span class="nav-count">{hasChildren ? getWorkflowCardCount(parent.id) : getBoardCardCount(parent.id)}</span>
          </div>

          <!-- Children (shown when not collapsed) -->
          {#if !isCollapsed}
            {#each children as child (child.id)}
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <div
                class="nav-item child-item"
                class:active={$currentView === 'board' && $currentBoardId === child.id}
                on:click={() => setView('board', child.id)}
                on:keydown={e => e.key === 'Enter' && setView('board', child.id)}
                role="button"
                tabindex="0"
              >
                <span class="board-dot" style="background: {child.color}"></span>
                <span class="board-name-text">{child.name}</span>
                <button class="board-rename-btn" on:click|stopPropagation={() => openEditBoard(child.id)} title="Edit">✎</button>
                <span class="nav-count">{getBoardCardCount(child.id)}</span>
              </div>
            {/each}
          {/if}
        </div>
      {/each}

      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="new-board" on:click={openNewBoard} role="button" tabindex="0" on:keydown={e => e.key === 'Enter' && openNewBoard()}>
        + New workflow
      </div>

      {#if archivedBoards.length > 0}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div class="archived-toggle" on:click={() => showArchived = !showArchived} role="button" tabindex="0" on:keydown={e => e.key === 'Enter' && (showArchived = !showArchived)}>
          Archived ({archivedBoards.length}) <span style="font-size:9px;">{showArchived ? '▴' : '▾'}</span>
        </div>
        {#if showArchived}
          {#each archivedBoards as b (b.id)}
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="nav-item archived-item">
              <span class="board-dot" style="background:{b.color}"></span>
              <span class="board-name-text">{b.name}</span>
              <button class="board-rename-btn" title="Restore"
                on:click|stopPropagation={() => { updateBoard(b.id, { archived: false }); setView('board', b.id); }}>↩</button>
            </div>
          {/each}
        {/if}
      {/if}
    </div>

    <div class="sidebar-footer">
      {#if $currentUser && !$currentUser.isAnonymous}
        <div class="user-info">
          {#if $currentUser.photoURL}
            <img src={$currentUser.photoURL} alt="" class="user-avatar" referrerpolicy="no-referrer" />
          {/if}
          <span class="user-name">{$currentUser.displayName || $currentUser.email}</span>
          <button class="btn-link" on:click={signOutUser} title="Sign out">↩</button>
        </div>
      {:else}
        <button class="btn" style="width: 100%; margin-bottom: 8px;" on:click={signInWithGoogle}>
          Sign in with Google
        </button>
      {/if}
      <button class="btn" style="width: 100%;" on:click={() => showPairingModal.set(true)}>
        Link device
      </button>
    </div>
  </aside>

  <!-- Main content -->
  <main class="main">
    <slot />
  </main>
</div>

{#if $appLoading}
  <div class="app-loading">
    <div class="loading-spinner"></div>
  </div>
{/if}

{#if showShortcuts}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click|self={() => showShortcuts = false}>
    <div class="modal" style="max-width: 320px;">
      <div class="modal-header">
        <span style="font-size: 13px; font-weight: 500;">Keyboard shortcuts</span>
        <button class="modal-close" on:click={() => showShortcuts = false}>×</button>
      </div>
      <div class="modal-body" style="padding: 14px 22px 20px;">
        <div class="shortcut-list">
          <div class="shortcut-row"><kbd>N</kbd><span>New task</span></div>
          <div class="shortcut-row"><kbd>T</kbd><span>Today view</span></div>
          <div class="shortcut-row"><kbd>W</kbd><span>Waiting On view</span></div>
          <div class="shortcut-row"><kbd>Esc</kbd><span>Close modal</span></div>
          <div class="shortcut-row"><kbd>?</kbd><span>Show shortcuts</span></div>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if $showBoardModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click|self={() => showBoardModal.set(false)}>
    <div class="modal" style="max-width: 360px;">
      <div class="modal-header">
        <span style="font-size: 13px; font-weight: 500;">{modalTitle}</span>
        <button class="modal-close" on:click={() => showBoardModal.set(false)}>×</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <div class="field-label">Name</div>
          <!-- svelte-ignore a11y-autofocus -->
          <input class="field-input" bind:value={newBoardName} placeholder={newBoardParentId ? 'e.g. Ongoing Work' : 'e.g. Client D'} autofocus on:keydown={e => e.key === 'Enter' && saveBoardModal()}>
        </div>
        <div class="field">
          <div class="field-label">Color</div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; align-items: center;">
            {#each BOARD_COLORS as c}
              <button
                style="width: 24px; height: 24px; border-radius: 50%; background: {c}; border: 2px solid {newBoardColor === c ? '#1a1814' : 'transparent'}; cursor: pointer;"
                on:click={() => newBoardColor = c}
                aria-label="Color {c}"
              ></button>
            {/each}
            <label class="color-wheel-wrap" title="Custom color" style="border: 2px solid {BOARD_COLORS.includes(newBoardColor) ? 'transparent' : '#1a1814'};">
              <input type="color" class="color-wheel-input" bind:value={newBoardColor} aria-label="Custom color" />
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" on:click={saveBoardModal}>
            {$editingBoardId ? 'Save' : 'Create'}
          </button>
          <button class="btn" on:click={() => showBoardModal.set(false)}>Cancel</button>
          {#if $editingBoardId}
            <button class="btn-danger" style="margin-left: auto;" on:click={() => { archiveBoard($editingBoardId); showBoardModal.set(false); }}>
              Archive
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .offline-banner {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--ink);
    color: var(--bg);
    text-align: center;
    font-size: 12px;
    padding: 8px;
    z-index: 999;
    letter-spacing: 0.2px;
  }

  .app { display: flex; height: 100vh; }

  .app-loading {
    position: fixed;
    inset: 0;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .loading-spinner {
    width: 28px;
    height: 28px;
    border: 2px solid var(--line);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .sidebar {
    min-width: 220px;
    max-width: 320px;
    width: max-content;
    background: var(--surface);
    border-right: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }
  .sidebar-header {
    padding: 24px 20px 16px;
    border-bottom: 1px solid var(--line);
  }
  .logo {
    font-family: var(--serif);
    font-size: 22px;
    font-weight: 500;
    font-style: italic;
    letter-spacing: -0.5px;
  }
  .logo::after { content: '·'; color: var(--accent); margin-left: 4px; }
  .sync-status { font-size: 11px; color: var(--ink-3); margin-top: 4px; letter-spacing: 0.3px; }
  .sync-dot {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--ink-3);
    margin-right: 6px;
    vertical-align: 1px;
  }
  .sync-dot.synced { background: var(--green); }
  .sidebar-section { padding: 16px 12px 8px; }
  .sidebar-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--ink-3);
    padding: 0 8px 8px;
    font-weight: 500;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 6px;
    cursor: pointer;
    margin-bottom: 1px;
    color: var(--ink-2);
    font-size: 13px;
    user-select: none;
  }
  .nav-item:hover { background: var(--surface-2); }
  .nav-item.active { background: var(--accent-bg); color: var(--ink); font-weight: 500; }
  .star { font-family: var(--serif); color: var(--accent); }
  .board-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .board-name-text { flex: 1; white-space: nowrap; }

  .chevron-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
  .chevron {
    font-size: 14px;
    color: var(--ink-3);
    transition: transform 0.15s;
    display: inline-block;
    width: 14px;
    text-align: center;
  }
  .chevron.collapsed { transform: rotate(-90deg); }

  .workflow-group { margin-bottom: 2px; }

  .child-item {
    padding-left: 48px;
    font-size: 12px;
    position: relative;
  }
  .child-item::before {
    content: '';
    position: absolute;
    left: 28px;
    top: 50%;
    width: 10px;
    height: 1px;
    background: var(--line-strong);
  }

.board-rename-btn {
    display: none;
    background: none;
    border: none;
    color: var(--ink-3);
    cursor: pointer;
    padding: 0 2px;
    font-size: 13px;
    line-height: 1;
    flex-shrink: 0;
  }
  .board-rename-btn:hover { color: var(--ink); }
  .nav-item:hover .board-rename-btn { display: inline; }

  .color-wheel-wrap {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    overflow: hidden;
    cursor: pointer;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
  }
  .color-wheel-input {
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
    padding: 0;
    border: none;
  }

  .nav-count {
    margin-left: auto;
    font-size: 11px;
    color: var(--ink-3);
    background: var(--surface-2);
    padding: 1px 6px;
    border-radius: 8px;
    min-width: 20px;
    text-align: center;
  }
  .nav-count.accent { background: var(--accent-bg); color: var(--accent); }
  .new-board { color: var(--ink-3); font-size: 12px; padding: 8px 10px; cursor: pointer; }
  .new-board:hover { color: var(--ink); }
  .archived-toggle {
    color: var(--ink-3);
    font-size: 11px;
    padding: 6px 10px;
    cursor: pointer;
    margin-top: 4px;
    user-select: none;
  }
  .archived-toggle:hover { color: var(--ink-2); }
  .archived-item { opacity: 0.5; }
  .archived-item:hover { opacity: 1; }
  .sidebar-footer { margin-top: auto; padding: 12px; border-top: 1px solid var(--line); }
  .user-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 4px;
    margin-bottom: 8px;
    font-size: 12px;
    color: var(--ink-2);
  }
  .user-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .user-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .btn-link {
    background: none;
    border: none;
    color: var(--ink-3);
    cursor: pointer;
    font-size: 14px;
    padding: 0 2px;
    flex-shrink: 0;
  }
  .btn-link:hover { color: var(--ink); }
  .main { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

  .shortcut-list { display: flex; flex-direction: column; gap: 10px; }
  .shortcut-row { display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--ink-2); }
  .shortcut-row span { flex: 1; }
  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    padding: 3px 7px;
    border-radius: 5px;
    border: 1px solid var(--line-strong);
    background: var(--surface-2);
    font-family: var(--sans);
    font-size: 11px;
    font-weight: 500;
    color: var(--ink-2);
    letter-spacing: 0.3px;
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .app { flex-direction: column; height: auto; }
    .sidebar {
      width: 100%;
      flex-direction: row;
      overflow-x: auto;
      border-right: none;
      border-bottom: 1px solid var(--line);
      padding: 6px 8px;
      gap: 2px;
    }
    .sidebar-header { display: none; }
    .sidebar-section { padding: 0; display: flex; gap: 2px; flex-shrink: 0; }
    .sidebar-label { display: none; }
    .nav-item { white-space: nowrap; padding: 0 14px; flex-shrink: 0; min-height: 44px; display: flex; align-items: center; }
    .child-item { padding-left: 14px; }
    .new-board { display: none; }
    .archived-toggle { display: none; }
    .archived-item { display: none; }
    .sidebar-footer { display: none; }
    .offline-banner { padding: 10px 16px; padding-bottom: max(10px, env(safe-area-inset-bottom)); }
    .main { height: auto; }
  }
</style>
