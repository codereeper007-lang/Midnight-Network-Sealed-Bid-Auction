import { midnightService } from './services/midnightService.ts';

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const btnPrimaryAction = document.getElementById('btn-primary-action') as HTMLButtonElement;
  const ctaText = document.getElementById('cta-text') as HTMLElement;
  const ctaIcon = document.getElementById('cta-icon') as HTMLElement;
  const btnSignIn = document.getElementById('btn-sign-in') as HTMLButtonElement;
  
  // Modal Elements
  const bidModal = document.getElementById('bid-modal') as HTMLElement;
  const btnCloseModal = document.getElementById('btn-close-modal') as HTMLButtonElement;
  const btnCancelBid = document.getElementById('btn-cancel-bid') as HTMLButtonElement;
  const bidForm = document.getElementById('bid-form') as HTMLFormElement;
  const inputBidAmount = document.getElementById('input-bid-amount') as HTMLInputElement;
  const inputBidderSecret = document.getElementById('input-bidder-secret') as HTMLInputElement;
  const btnGenerateSecret = document.getElementById('btn-generate-secret') as HTMLButtonElement;
  const btnSubmitZkBid = document.getElementById('btn-submit-zk-bid') as HTMLButtonElement;
  const zkOutputPreview = document.getElementById('zk-output-preview') as HTMLElement;
  const previewNullifier = document.getElementById('preview-nullifier') as HTMLElement;
  const previewCommitment = document.getElementById('preview-commitment') as HTMLElement;
  const previewTxHash = document.getElementById('preview-txhash') as HTMLElement;

  // Step Indicators
  const stepWitness = document.getElementById('step-witness') as HTMLElement;
  const stepCircuit = document.getElementById('step-circuit') as HTMLElement;
  const stepLedger = document.getElementById('step-ledger') as HTMLElement;

  // Toast Container
  const toastContainer = document.getElementById('toast-container') as HTMLElement;

  // Stat Counter Elements
  const statElements = document.querySelectorAll<HTMLElement>('.stat-num');

  // Initialize random secret on load
  generateAndSetSecret();

  // Trigger initial stat animations
  animateStatCounters();

  // --------------------------------------------------------------------------
  // Wallet Connection & CTA Handling
  // --------------------------------------------------------------------------
  btnPrimaryAction.addEventListener('click', async () => {
    const wallet = midnightService.getWalletState();

    if (!wallet.isConnected) {
      // Connect Wallet
      ctaText.textContent = "Connecting...";
      btnPrimaryAction.disabled = true;

      try {
        const connectedWallet = await midnightService.connectLaceWallet();
        btnPrimaryAction.disabled = false;
        btnPrimaryAction.classList.add('connected');
        ctaIcon.className = "fa-solid fa-gavel";
        ctaText.textContent = "Submit Bid";

        showToast("Connected to Lace Wallet Beta (Preview Testnet)", "success");
      } catch (err) {
        btnPrimaryAction.disabled = false;
        ctaText.textContent = "Connect Lace Wallet";
        showToast("Wallet connection failed", "error");
      }
    } else {
      // Already connected -> Open ZK Bid Modal
      openBidModal();
    }
  });

  btnSignIn?.addEventListener('click', async () => {
    btnPrimaryAction.click();
  });

  // --------------------------------------------------------------------------
  // Modal Interactions
  // --------------------------------------------------------------------------
  function openBidModal() {
    bidModal.classList.add('open');
    bidModal.setAttribute('aria-hidden', 'false');
    resetZkTracker();
    zkOutputPreview.style.display = 'none';
    if (!inputBidderSecret.value) {
      generateAndSetSecret();
    }
    inputBidAmount.focus();
  }

  function closeBidModal() {
    bidModal.classList.remove('open');
    bidModal.setAttribute('aria-hidden', 'true');
  }

  btnCloseModal.addEventListener('click', closeBidModal);
  btnCancelBid.addEventListener('click', closeBidModal);

  bidModal.addEventListener('click', (e) => {
    if (e.target === bidModal) {
      closeBidModal();
    }
  });

  btnGenerateSecret.addEventListener('click', () => {
    generateAndSetSecret();
    showToast("New private secret credential generated locally", "info");
  });

  function generateAndSetSecret() {
    const secret = midnightService.generateRandomSecret();
    inputBidderSecret.value = secret;
  }

  // --------------------------------------------------------------------------
  // ZK Sealed Bid Submission Workflow
  // --------------------------------------------------------------------------
  bidForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = Number(inputBidAmount.value);
    const secret = inputBidderSecret.value;

    if (!amount || amount < 100) {
      showToast("Minimum bid reserve is 100 tDUST", "error");
      return;
    }

    // Set UI to loading
    btnSubmitZkBid.disabled = true;
    const btnText = btnSubmitZkBid.querySelector('.btn-text') as HTMLElement;
    const spinner = btnSubmitZkBid.querySelector('.spinner') as HTMLElement;
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';

    try {
      const result = await midnightService.submitSealedBid(amount, secret, (step) => {
        setZkStep(step);
      });

      // Show proof & transaction output
      previewNullifier.textContent = result.nullifier;
      previewCommitment.textContent = result.bidCommitment;
      previewTxHash.textContent = result.txHash;
      zkOutputPreview.style.display = 'flex';

      showToast(`ZK Bid successfully cast! Tx: ${result.txHash.slice(0, 10)}...`, "success");

      // Update Footer Stats
      const valBids = document.querySelector('#val-bids .stat-num') as HTMLElement;
      if (valBids) {
        valBids.setAttribute('data-target', result.totalBids.toString());
        valBids.textContent = result.totalBids.toString();
      }

      // Update High Bid if amount is higher
      const valHighBid = document.querySelector('#val-highbid .stat-num') as HTMLElement;
      if (valHighBid) {
        const currentHigh = Number(valHighBid.getAttribute('data-target') || 2450);
        if (amount > currentHigh) {
          valHighBid.setAttribute('data-target', amount.toString());
          valHighBid.textContent = amount.toString();
        }
      }

      setTimeout(() => {
        closeBidModal();
        // Reset secret for next bid
        generateAndSetSecret();
        inputBidAmount.value = '';
      }, 2500);

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Circuit execution failed";
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
        // easeOutExpo
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
