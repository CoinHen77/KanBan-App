<script>
  import { currentView, currentBoardId, editingCardId, showPairingModal, boards, createCard } from '$lib/store.js';
  import { uid } from '$lib/logic.js';
  import TodayView from '$lib/TodayView.svelte';
  import BoardView from '$lib/BoardView.svelte';
  import WaitingOnView from '$lib/WaitingOnView.svelte';
  import CardModal from '$lib/CardModal.svelte';

  // Pairing modal state
  let pairingCode = '';
  let pairingMode = 'generate';
  let enteredCode = '';
  let countdown = 299;
  let countdownInterval = null;

  function openGenerate() {
    pairingMode = 'generate';
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    pairingCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    countdown = 299;
    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      countdown--;
      if (countdown <= 0) { clearInterval(countdownInterval); showPairingModal.set(false); }
    }, 1000);
  }

  function formatCountdown(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  $: if ($showPairingModal) openGenerate();
  $: if (!$showPairingModal) clearInterval(countdownInterval);

  // Keyboard shortcuts
  function onKeydown(e) {
    if (e.key === 'Escape') return; // handled in CardModal
    if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && !$editingCardId) {
      const tag = document.activeElement?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      const b = $boards.filter(b => !b.archived)[0];
      const bid = $currentView === 'board' ? $currentBoardId : b?.id;
      if (bid) createCard(bid);
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if $currentView === 'today'}
  <TodayView />
{:else if $currentView === 'board'}
  <BoardView />
{:else if $currentView === 'waiting'}
  <WaitingOnView />
{/if}

{#if $editingCardId}
  <CardModal />
{/if}

<!-- Pairing modal (UI stub; sync connected in Step 3) -->
{#if $showPairingModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-overlay" on:click|self={() => showPairingModal.set(false)}>
    <div class="modal" style="max-width: 380px;">
      <div class="modal-header">
        <span style="font-size: 13px; font-weight: 500;">Link another device</span>
        <button class="modal-close" on:click={() => showPairingModal.set(false)}>×</button>
      </div>
      <div class="modal-body" style="text-align: center;">
        <div style="display: flex; gap: 8px; justify-content: center; margin-bottom: 18px;">
          <button class="filter-pill" class:active={pairingMode === 'generate'} on:click={openGenerate}>Show code</button>
          <button class="filter-pill" class:active={pairingMode === 'enter'} on:click={() => pairingMode = 'enter'}>Enter code</button>
        </div>

        {#if pairingMode === 'generate'}
          <p style="color: var(--ink-2); font-size: 13px; margin-bottom: 18px;">Enter this code on your other device within 5 minutes.</p>
          <div style="font-family: var(--serif); font-size: 36px; font-weight: 500; letter-spacing: 6px; padding: 22px; background: var(--bg); border-radius: 8px; margin-bottom: 12px;">
            {pairingCode.slice(0, 3)}-{pairingCode.slice(3)}
          </div>
          <div style="font-size: 11px; color: var(--ink-3); font-style: italic; font-family: var(--serif);">
            Expires in {formatCountdown(countdown)}
          </div>
        {:else}
          <p style="color: var(--ink-2); font-size: 13px; margin-bottom: 18px;">Enter the code shown on your other device.</p>
          <input class="field-input" style="text-align: center; font-size: 20px; letter-spacing: 6px; font-family: var(--serif);"
            placeholder="XXX-XXX" maxlength="7" bind:value={enteredCode}>
          <button class="btn btn-primary" style="width: 100%; margin-top: 12px;"
            on:click={() => alert('Sync not yet connected — coming in Step 3.')}>
            Link devices
          </button>
        {/if}

        <div style="text-align: left; margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 12px; color: var(--ink-2); line-height: 1.6;">
          <strong style="font-weight: 500; color: var(--ink); display: block; margin-bottom: 4px;">Note</strong>
          Sync not yet connected — data is saved locally in this browser only.
        </div>
      </div>
    </div>
  </div>
{/if}
