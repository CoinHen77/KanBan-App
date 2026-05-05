<script>
  import { get } from 'svelte/store';
  import { currentView, currentBoardId, editingCardId, showPairingModal, boards, createCard, currentAuthUid, currentUserId } from '$lib/store.js';
  import { createPairingCode, watchPairingCode, submitPairingCode, cancelPairingCode, unlinkDevice } from '$lib/pairing.js';
  import TodayView from '$lib/TodayView.svelte';
  import BoardView from '$lib/BoardView.svelte';
  import WaitingOnView from '$lib/WaitingOnView.svelte';
  import CardModal from '$lib/CardModal.svelte';

  // Pairing modal state
  let tab = 'generate';
  let hostState = 'idle'; // idle | starting | waiting | linked | error
  let guestState = 'idle'; // idle | linking | linked | error
  let pairingCode = '';
  let enteredCode = '';
  let countdown = 300;
  let errorMsg = '';
  let countdownInterval = null;
  let watchUnsub = null;
  let submitUnsub = null;

  $: isLinked = $currentAuthUid && $currentUserId && $currentAuthUid !== $currentUserId;

  // Auto-start host pairing when modal opens and auth is ready
  $: if ($showPairingModal && $currentAuthUid) {
    if (!isLinked && hostState === 'idle') startHostPairing();
  }

  async function startHostPairing() {
    if (hostState !== 'idle') return;
    const authUid = get(currentAuthUid);
    if (!authUid) return;
    hostState = 'starting';
    try {
      pairingCode = await createPairingCode(authUid);
      hostState = 'waiting';
      countdown = 300;
      clearInterval(countdownInterval);
      countdownInterval = setInterval(() => {
        countdown--;
        if (countdown <= 0) {
          clearInterval(countdownInterval);
          if (watchUnsub) { watchUnsub(); watchUnsub = null; }
          hostState = 'idle';
          pairingCode = '';
          startHostPairing(); // Auto-regenerate
        }
      }, 1000);
      watchUnsub = watchPairingCode(pairingCode, authUid,
        () => {
          clearInterval(countdownInterval);
          if (watchUnsub) { watchUnsub(); watchUnsub = null; }
          hostState = 'linked';
        },
        (msg) => {
          clearInterval(countdownInterval);
          hostState = 'error';
          errorMsg = msg;
        }
      );
    } catch (e) {
      hostState = 'error';
      errorMsg = e.message;
    }
  }

  async function regenerateCode() {
    if (watchUnsub) { watchUnsub(); watchUnsub = null; }
    clearInterval(countdownInterval);
    hostState = 'idle';
    pairingCode = '';
    errorMsg = '';
    await startHostPairing();
  }

  async function submitCode() {
    const authUid = get(currentAuthUid);
    if (!authUid) return;
    const code = enteredCode.replace(/-/g, '').toUpperCase().trim();
    if (code.length !== 6) { errorMsg = 'Please enter a 6-character code.'; return; }
    guestState = 'linking';
    errorMsg = '';
    if (submitUnsub) { submitUnsub(); submitUnsub = null; }
    const unsub = await submitPairingCode(code, authUid,
      () => {
        guestState = 'linked';
        setTimeout(() => location.reload(), 1500);
      },
      (msg) => {
        guestState = 'error';
        errorMsg = msg;
      }
    );
    if (unsub) submitUnsub = unsub;
  }

  function doUnlink() {
    unlinkDevice();
    location.reload();
  }

  function closeModal() {
    if (pairingCode && hostState === 'waiting') {
      cancelPairingCode(pairingCode, get(currentAuthUid)).catch(() => {});
    }
    clearInterval(countdownInterval);
    if (watchUnsub) { watchUnsub(); watchUnsub = null; }
    if (submitUnsub) { submitUnsub(); submitUnsub = null; }
    hostState = 'idle';
    guestState = 'idle';
    pairingCode = '';
    enteredCode = '';
    errorMsg = '';
    showPairingModal.set(false);
  }

  function formatCountdown(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // Keyboard shortcuts
  function onKeydown(e) {
    if (e.key === 'Escape') return;
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

{#if $showPairingModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click|self={closeModal}>
    <div class="modal" style="max-width: 380px;">
      <div class="modal-header">
        <span style="font-size: 13px; font-weight: 500;">Link another device</span>
        <button class="modal-close" on:click={closeModal}>×</button>
      </div>
      <div class="modal-body" style="text-align: center;">

        {#if isLinked}
          <div style="margin-bottom: 20px;">
            <div style="font-size: 24px; color: var(--green); margin-bottom: 10px;">●</div>
            <div style="font-weight: 500; font-size: 15px; margin-bottom: 6px;">Device linked</div>
            <div style="font-size: 13px; color: var(--ink-2); line-height: 1.5;">
              This device is syncing data from another device.
            </div>
          </div>
          <button class="btn" style="width: 100%;" on:click={doUnlink}>Unlink this device</button>

        {:else}
          <div style="display: flex; gap: 8px; justify-content: center; margin-bottom: 18px;">
            <button class="filter-pill" class:active={tab === 'generate'}
              on:click={() => { tab = 'generate'; if (hostState === 'idle') startHostPairing(); }}>
              Show code
            </button>
            <button class="filter-pill" class:active={tab === 'enter'}
              on:click={() => { tab = 'enter'; guestState = 'idle'; enteredCode = ''; errorMsg = ''; }}>
              Enter code
            </button>
          </div>

          {#if tab === 'generate'}
            {#if hostState === 'idle' || hostState === 'starting'}
              <div style="color: var(--ink-3); font-size: 13px; padding: 20px 0;">Generating code…</div>
            {:else if hostState === 'waiting'}
              <p style="color: var(--ink-2); font-size: 13px; margin-bottom: 18px;">
                Enter this code on your other device within 5 minutes.
              </p>
              <div style="font-family: var(--serif); font-size: 36px; font-weight: 500; letter-spacing: 6px; padding: 22px; background: var(--bg); border-radius: 8px; margin-bottom: 12px;">
                {pairingCode.slice(0, 3)}-{pairingCode.slice(3)}
              </div>
              <div style="font-size: 11px; color: var(--ink-3); font-style: italic; font-family: var(--serif);">
                Expires in {formatCountdown(countdown)}
              </div>
            {:else if hostState === 'linked'}
              <div style="padding: 20px 0;">
                <div style="font-size: 24px; color: var(--green); margin-bottom: 10px;">✓</div>
                <div style="font-weight: 500; font-size: 15px; margin-bottom: 6px;">Device linked!</div>
                <div style="font-size: 13px; color: var(--ink-2); margin-bottom: 18px;">
                  The other device will now sync your data.
                </div>
                <button class="btn btn-primary" on:click={closeModal}>Done</button>
              </div>
            {:else if hostState === 'error'}
              <div style="padding: 20px 0;">
                <div style="font-size: 13px; color: var(--red); margin-bottom: 16px;">{errorMsg}</div>
                <button class="btn btn-primary" on:click={regenerateCode}>Regenerate</button>
              </div>
            {/if}

          {:else}
            {#if guestState === 'idle' || guestState === 'error'}
              <p style="color: var(--ink-2); font-size: 13px; margin-bottom: 18px;">
                Enter the code shown on your other device.
              </p>
              {#if guestState === 'error'}
                <div style="font-size: 12px; color: var(--red); margin-bottom: 10px;">{errorMsg}</div>
              {/if}
              <input
                class="field-input"
                style="text-align: center; font-size: 20px; letter-spacing: 6px; font-family: var(--serif);"
                placeholder="XXX-XXX"
                maxlength="7"
                bind:value={enteredCode}
                on:keydown={e => e.key === 'Enter' && submitCode()}
              />
              <button class="btn btn-primary" style="width: 100%; margin-top: 12px;" on:click={submitCode}>
                Link devices
              </button>
            {:else if guestState === 'linking'}
              <div style="padding: 20px 0;">
                <div style="font-size: 13px; color: var(--ink-2); margin-bottom: 8px;">Waiting for confirmation…</div>
                <div style="font-size: 11px; color: var(--ink-3);">Keep this modal open on both devices.</div>
              </div>
            {:else if guestState === 'linked'}
              <div style="padding: 20px 0;">
                <div style="font-size: 24px; color: var(--green); margin-bottom: 10px;">✓</div>
                <div style="font-weight: 500; font-size: 15px; margin-bottom: 6px;">Linked!</div>
                <div style="font-size: 13px; color: var(--ink-2);">Reloading to sync data…</div>
              </div>
            {/if}
          {/if}

          <div style="text-align: left; margin-top: 22px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 12px; color: var(--ink-2); line-height: 1.6;">
            <strong style="font-weight: 500; color: var(--ink); display: block; margin-bottom: 4px;">How it works</strong>
            Device A shows a code · Device B enters it · B syncs A's data
          </div>
        {/if}

      </div>
    </div>
  </div>
{/if}
