import { midnightAuctionService } from './services/midnightService.ts';
import { walletService, WalletAccountState } from './services/wallet.ts';

document.addEventListener('DOMContentLoaded', () => {
  // Header Elements
  const btnSignIn = document.getElementById('btn-sign-in') as HTMLButtonElement;
  const headerWalletText = document.getElementById('header-wallet-btn-text') as HTMLElement;
  const walletStatusBadge = document.getElementById('wallet-status-badge') as HTMLElement;
  const walletAddressDisplay = document.getElementById('wallet-address-display') as HTMLElement;
  const btnDisconnectWallet = document.getElementById('btn-disconnect-wallet') as HTMLButtonElement;

  // Nav Links
  const navActivity = document.getElementById('nav-activity') as HTMLAnchorElement;

  // Hero Elements
  const btnPrimaryAction = document.getElementById('btn-primary-action') as HTMLButtonElement;
  const btnRevealAction = document.getElementById('btn-reveal-action') as HTMLButtonElement;
  const btnViewActivity = document.getElementById('btn-view-activity') as HTMLButtonElement;
  const ctaText = document.getElementById('cta-text') as HTMLElement;
  const ctaIcon = document.getElementById('cta-icon') as HTMLElement;

  // Modal Elements (Bid & Reveal)
  const bidModal = document.getElementById('bid-modal') as HTMLElement;
  const modalHeading = document.getElementById('modal-heading') as HTMLElement;
  const modalSubtitle = document.getElementById('modal-subtitle') as HTMLElement;
  const btnCloseModal = document.getElementById('btn-close-modal') as HTMLButtonElement;
  const btnCancelBid = document.getElementById('btn-cancel-bid') as HTMLButtonElement;
  const bidForm = document.getElementById('bid-form') as HTMLFormElement;
  const groupBidAmount = document.getElementById('group-bid-amount') as HTMLElement;
  const inputBidAmount = document.getElementById('input-bid-amount') as HTMLInputElement;
  const btnSubmitZkBid = document.getElementById('btn-submit-zk-bid') as HTMLButtonElement;
  const progressStatusBanner = document.getElementById('progress-status-banner') as HTMLElement;
  const progressStatusText = document.getElementById('progress-status-text') as HTMLElement;
  const zkOutputPreview = document.getElementById('zk-output-preview') as HTMLElement;
  const previewCommitment = document.getElementById('preview-commitment') as HTMLElement;
  const previewTxHash = document.getElementById('preview-txhash') as HTMLElement;

  // Activity Modal Elements
  const activityModal = document.getElementById('activity-modal') as HTMLElement;
  const btnCloseActivityModal = document.getElementById('btn-close-activity-modal') as HTMLButtonElement;
  const btnCloseActivity = document.getElementById('btn-close-activity') as HTMLButtonElement;
  const activityListContainer = document.getElementById('activity-list-container') as HTMLElement;

  // Step Indicators
  const stepWitness = document.getElementById('step-witness') as HTMLElement;
  const stepCircuit = document.getElementById('step-circuit') as HTMLElement;
  const stepLedger = document.getElementById('step-ledger') as HTMLElement;

  // Toast Container
  const toastContainer = document.getElementById('toast-container') as HTMLElement;

  // Stat Counter Elements
  const statElements = document.querySelectorAll<HTMLElement>('.stat-num');

  let currentModalMode: 'place' | 'reveal' = 'place';

  // Animate stats on page load
  animateStatCounters();

  // --------------------------------------------------------------------------
  // Reactive Wallet State Management
  // --------------------------------------------------------------------------
  walletService.subscribe((wallet: WalletAccountState) => {
    if (wallet.isConnected && wallet.address) {
      // Truncate address for UI display (e.g. mn_prev...8f9a)
      const truncated = wallet.address.length > 18
        ? `${wallet.address.slice(0, 9)}...${wallet.address.slice(-6)}`
        : wallet.address;

      walletAddressDisplay.textContent = `${wallet.walletName || '1AM'}: ${truncated}`;
      walletStatusBadge.style.display = 'flex';
      btnSignIn.style.display = 'none';

      btnPrimaryAction.classList.add('connected');
      ctaIcon.className = "fa-solid fa-gavel";
      ctaText.textContent = "Place Sealed Bid";
      btnRevealAction.style.display = 'inline-flex';
    } else {
      walletStatusBadge.style.display = 'none';
      btnSignIn.style.display = 'flex';
      headerWalletText.textContent = "Connect 1AM";

      btnPrimaryAction.classList.remove('connected');
      ctaIcon.className = "fa-solid fa-wallet";
      ctaText.textContent = "Connect 1AM Wallet";
      btnRevealAction.style.display = 'none';
    }
  });

  // Connect wallet handlers
  const handleConnect = async () => {
    ctaText.textContent = "Connecting 1AM...";
    btnPrimaryAction.disabled = true;
    try {
      const state = await walletService.connect();
      showToast(`Connected to ${state.walletName} Wallet (${state.address?.slice(0, 10)}...)`, "success");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "1AM Wallet extension not detected in browser.";
      showToast(errorMsg, "error");
    } finally {
      btnPrimaryAction.disabled = false;
    }
  };

  btnSignIn.addEventListener('click', handleConnect);

  btnPrimaryAction.addEventListener('click', async () => {
    const wallet = walletService.getState();
    if (!wallet.isConnected) {
      await handleConnect();
    } else {
      openBidModal('place');
    }
  });

  btnRevealAction.addEventListener('click', () => {
    openBidModal('reveal');
  });

  btnDisconnectWallet.addEventListener('click', () => {
    walletService.disconnect();
    showToast("Midnight Wallet session disconnected", "info");
  });

  // --------------------------------------------------------------------------
  // Activity Modal Handlers
  // --------------------------------------------------------------------------
  function openActivityModal() {
    renderActivityList();
    activityModal.classList.add('open');
    activityModal.setAttribute('aria-hidden', 'false');
  }

  function closeActivityModal() {
    activityModal.classList.remove('open');
    activityModal.setAttribute('aria-hidden', 'true');
  }

  btnViewActivity.addEventListener('click', openActivityModal);
  navActivity.addEventListener('click', (e) => {
    e.preventDefault();
    openActivityModal();
  });
  btnCloseActivityModal.addEventListener('click', closeActivityModal);
  btnCloseActivity.addEventListener('click', closeActivityModal);

  activityModal.addEventListener('click', (e) => {
    if (e.target === activityModal) closeActivityModal();
  });

  function renderActivityList() {
    const history = midnightAuctionService.getTxHistory();
    if (history.length === 0) {
      activityListContainer.innerHTML = '<div style="color:var(--muted); text-align:center; padding:20px;">No on-chain transactions recorded yet.</div>';
      return;
    }

    activityListContainer.innerHTML = history.map((tx) => `
      <div class="activity-item">
        <div class="activity-info">
          <div class="activity-action">
            <i class="fa-solid ${tx.action === 'place_bid' ? 'fa-shield-halved' : tx.action === 'reveal_bid' ? 'fa-eye' : 'fa-rocket'}" style="color:#38ef7d;"></i>
            <span>${tx.action === 'place_bid' ? 'Placed Sealed Bid' : tx.action === 'reveal_bid' ? `Revealed Bid (${tx.amount} tDUST)` : 'Contract Genesis Initialize'}</span>
          </div>
          <span class="activity-time">${new Date(tx.timestamp).toLocaleString()}</span>
        </div>
        <div class="activity-links">
          <span class="badge-confirmed">CONFIRMED</span>
          <a href="${tx.explorerTxUrl}" target="_blank" class="explorer-btn">
            1AM Explorer <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:10px;"></i>
          </a>
        </div>
      </div>
    `).join('');
  }

  // --------------------------------------------------------------------------
  // Modal Interactions (Bid & Reveal)
  // --------------------------------------------------------------------------
  function openBidModal(mode: 'place' | 'reveal') {
    currentModalMode = mode;
    bidModal.classList.add('open');
    bidModal.setAttribute('aria-hidden', 'false');
    resetZkTracker();
    zkOutputPreview.style.display = 'none';
    progressStatusBanner.style.display = 'none';

    const btnText = btnSubmitZkBid.querySelector('.btn-text') as HTMLElement;

    if (mode === 'place') {
      modalHeading.textContent = "Submit ZK Sealed Bid";
      modalSubtitle.textContent = "Private witness generated in local memory; secret is never exposed to DOM.";
      groupBidAmount.style.display = 'flex';
      btnText.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Generate Proof & Place Bid';
      inputBidAmount.value = '';
      inputBidAmount.focus();
    } else {
      modalHeading.textContent = "Reveal Sealed Bid & Verify Winner";
      modalSubtitle.textContent = "Proves preimage knowledge from private local storage to resolve the auction.";
      groupBidAmount.style.display = 'none';
      btnText.innerHTML = '<i class="fa-solid fa-eye"></i> Prove Knowledge & Reveal';
    }
  }

  function closeBidModal() {
    bidModal.classList.remove('open');
    bidModal.setAttribute('aria-hidden', 'true');
    progressStatusBanner.style.display = 'none';
  }

  btnCloseModal.addEventListener('click', closeBidModal);
  btnCancelBid.addEventListener('click', closeBidModal);

  bidModal.addEventListener('click', (e) => {
    if (e.target === bidModal) {
      closeBidModal();
    }
  });

  // --------------------------------------------------------------------------
  // ZK Sealed Bid & Reveal Submission Handlers
  // --------------------------------------------------------------------------
  bidForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    btnSubmitZkBid.disabled = true;
    const btnText = btnSubmitZkBid.querySelector('.btn-text') as HTMLElement;
    const spinner = btnSubmitZkBid.querySelector('.spinner') as HTMLElement;
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';
    progressStatusBanner.style.display = 'flex';

    try {
      if (currentModalMode === 'place') {
        const amount = Number(inputBidAmount.value);
        if (!amount || amount < 100) {
          showToast("Minimum bid reserve is 100 tDUST", "error");
          return;
        }

        const result = await midnightAuctionService.placeSealedBid(amount, (step, msg) => {
          setZkStep(step);
          if (msg) progressStatusText.textContent = msg;
        });

        previewCommitment.textContent = result.commitment;
        previewTxHash.innerHTML = `<a href="${result.explorerTxUrl}" target="_blank" style="color:#38ef7d;text-decoration:underline;">${result.txHash.slice(0, 14)}... (View on 1AM Explorer)</a>`;
        zkOutputPreview.style.display = 'flex';
        progressStatusBanner.style.display = 'none';

        showToast(`ZK Bid successfully submitted to Midnight Preview Testnet!`, "success");

        // Update Bids Placed counter
        const valBids = document.querySelector('#val-bids .stat-num') as HTMLElement;
        if (valBids) {
          valBids.setAttribute('data-target', result.totalBids.toString());
          valBids.textContent = result.totalBids.toString();
        }

        setTimeout(() => {
          closeBidModal();
          inputBidAmount.value = '';
        }, 2500);

      } else {
        // Reveal mode
        const result = await midnightAuctionService.revealLatestBid((step, msg) => {
          setZkStep(step);
          if (msg) progressStatusText.textContent = msg;
        });

        previewCommitment.textContent = `Amount: ${result.amount} tDUST`;
        previewTxHash.innerHTML = `<a href="${result.explorerTxUrl}" target="_blank" style="color:#38ef7d;text-decoration:underline;">${result.txHash.slice(0, 14)}... (View on 1AM Explorer)</a>`;
        zkOutputPreview.style.display = 'flex';
        progressStatusBanner.style.display = 'none';

        if (result.isWinner) {
          showToast(`🏆 Congratulations! You hold the highest bid: ${result.amount} tDUST!`, "success");
          const valHighBid = document.querySelector('#val-highbid .stat-num') as HTMLElement;
          if (valHighBid) {
            valHighBid.setAttribute('data-target', result.highestBid.toString());
            valHighBid.textContent = result.highestBid.toString();
          }
        } else {
          showToast(`Bid revealed (${result.amount} tDUST). Current highest is ${result.highestBid} tDUST.`, "info");
        }

        setTimeout(() => {
          closeBidModal();
        }, 2800);
      }
    } catch (err: unknown) {
      progressStatusBanner.style.display = 'none';
      const errorMessage = err instanceof Error ? err.message : "Circuit execution failed or rejected by wallet.";
      showToast(errorMessage, "error");
    } finally {
      btnSubmitZkBid.disabled = false;
      btnText.style.display = 'inline-block';
      spinner.style.display = 'none';
    }
  });

  // --------------------------------------------------------------------------
  // 3-Zone Tracker Steps
  // --------------------------------------------------------------------------
  function resetZkTracker() {
    stepWitness.classList.add('active');
    stepCircuit.classList.remove('active');
    stepLedger.classList.remove('active');
  }

  function setZkStep(step: 'witness' | 'circuit' | 'ledger') {
    if (step === 'witness') {
      stepWitness.classList.add('active');
      stepCircuit.classList.remove('active');
      stepLedger.classList.remove('active');
    } else if (step === 'circuit') {
      stepWitness.classList.add('active');
      stepCircuit.classList.add('active');
      stepLedger.classList.remove('active');
    } else if (step === 'ledger') {
      stepWitness.classList.add('active');
      stepCircuit.classList.add('active');
      stepLedger.classList.add('active');
    }
  }

  // --------------------------------------------------------------------------
  // Stat Counter Animation
  // --------------------------------------------------------------------------
  function animateStatCounters() {
    statElements.forEach((el) => {
      const targetStr = el.getAttribute('data-target') || '0';
      const target = parseFloat(targetStr);
      const isDecimal = targetStr.includes('.');
      const duration = 1600;
      const startTime = performance.now();

      function update(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = target * ease;

        if (isDecimal) {
          el.textContent = current.toFixed(2);
        } else {
          el.textContent = Math.floor(current).toLocaleString();
        }

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          el.textContent = targetStr;
        }
      }

      requestAnimationFrame(update);
    });
  }

  // --------------------------------------------------------------------------
  // Toast Notifications
  // --------------------------------------------------------------------------
  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconClass = 'fa-circle-info';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'error') iconClass = 'fa-circle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${iconClass}"></i>
      <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
});
