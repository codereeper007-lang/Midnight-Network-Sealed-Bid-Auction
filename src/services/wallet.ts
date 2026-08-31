/**
 * Genuine Midnight DApp Connector Service (1AM Wallet & Lace Beta for macOS & Web3)
 * Supports official namespaces: window.midnight['1am'], window.midnight.oneAm, window.midnight.mn1am, window.midnight.mnLace
 * Features macOS Vite HMR polling (50 attempts / 5s) and dynamic getConfiguration / balance synchronization.
 */

export interface MidnightWalletConfig {
  networkId: string;
  indexerUri?: string;
  indexerWsUri?: string;
  nodeUri?: string;
  proverServerUri?: string;
  proofServerUri?: string;
  substrateNodeUri?: string;
}

export interface WalletAccountState {
  isConnected: boolean;
  address: string | null;
  network: string;
  walletName: '1AM' | 'Lace' | null;
  dustBalance?: string | number | null;
  shieldedBalances?: Record<string, bigint> | null;
  config?: MidnightWalletConfig | null;
  proofProviderAvailable: boolean;
}

export interface MidnightWalletAPI {
  getConfiguration?: () => Promise<MidnightWalletConfig>;
  getUnshieldedAddress?: () => Promise<string>;
  getAddress?: () => Promise<string>;
  getDustBalance?: () => Promise<string | number>;
  getBalance?: () => Promise<string | number>;
  getShieldedBalances?: () => Promise<Record<string, bigint>>;
  state?: () => Promise<{ address: string; coinPublicKey?: string }>;
  accounts?: () => Promise<string[]>;
  prove?: (circuitId: string, privateInputs: unknown) => Promise<unknown>;
  submitTx?: (tx: unknown) => Promise<string>;
  submitTransaction?: (tx: unknown) => Promise<string>;
  balanceUnsealedTransaction?: (tx: unknown) => Promise<unknown>;
  signData?: (data: unknown) => Promise<unknown>;
}

export interface MidnightInjectedWallet {
  connect: (network?: string) => Promise<MidnightWalletAPI>;
  enable?: (network?: string) => Promise<MidnightWalletAPI>;
  isEnabled?: () => Promise<boolean>;
  apiVersion?: string;
  name?: string;
}

declare global {
  interface Window {
    midnight?: {
      '1am'?: MidnightInjectedWallet;
      oneAm?: MidnightInjectedWallet;
      mn1am?: MidnightInjectedWallet;
      mnLace?: MidnightInjectedWallet;
      [key: string]: unknown;
    };
  }
}

/**
 * Configure global network ID for Midnight DApp client
 */
export function setNetworkId(network: 'preview' | 'preprod' = 'preview'): void {
  if (typeof window !== 'undefined') {
    (window as unknown as { __MIDNIGHT_NETWORK_ID__?: string }).__MIDNIGHT_NETWORK_ID__ = network;
  }
  console.log(`[Midnight DApp] Network ID set to: ${network}`);
}

/**
 * macOS Polling Hook: Waits for asynchronous 1AM / Midnight extension DOM injection (50 attempts / 5s)
 */
export async function waitFor1AM(timeoutMs = 5000): Promise<{
  wallet: MidnightInjectedWallet;
  walletName: '1AM' | 'Lace';
}> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = Math.ceil(timeoutMs / 100);

    const interval = setInterval(() => {
      attempts++;

      const midnightObj = window.midnight;
      if (midnightObj) {
        // Priority 1: Official 1AM Wallet namespaces
        const oneAm = midnightObj['1am'] || midnightObj.oneAm || midnightObj.mn1am;
        if (oneAm && typeof (oneAm.connect || oneAm.enable) === 'function') {
          clearInterval(interval);
          return resolve({ wallet: oneAm, walletName: '1AM' });
        }

        // Priority 2: Midnight Lace Beta
        const lace = midnightObj.mnLace;
        if (lace && typeof (lace.connect || lace.enable) === 'function') {
          clearInterval(interval);
          return resolve({ wallet: lace, walletName: 'Lace' });
        }
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval);
        reject(
          new Error(
            "1AM Wallet Extension not found. Ensure you are using Chrome/Brave on Mac and have installed 1AM from [https://1am.xyz/](https://1am.xyz/)"
          )
        );
      }
    }, 100);
  });
}

export class WalletService {
  private accountState: WalletAccountState = {
    isConnected: false,
    address: null,
    network: "preview",
    walletName: null,
    dustBalance: null,
    shieldedBalances: null,
    config: null,
    proofProviderAvailable: false,
  };

  private activeWalletApi: MidnightWalletAPI | null = null;
  private listeners: ((state: WalletAccountState) => void)[] = [];

  constructor() {
    setNetworkId("preview");
  }

  public subscribe(callback: (state: WalletAccountState) => void): () => void {
    this.listeners.push(callback);
    callback({ ...this.accountState });
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      listener({ ...this.accountState });
    }
  }

  public getState(): WalletAccountState {
    return { ...this.accountState };
  }

  public getWalletApi(): MidnightWalletAPI | null {
    return this.activeWalletApi;
  }

  /**
   * Connect to 1AM Wallet using macOS polling and dynamic configuration fetching
   */
  public async connect(): Promise<WalletAccountState> {
    setNetworkId("preview");

    // 1. Wait for injection (macOS Polling - 50 attempts)
    const { wallet, walletName } = await waitFor1AM(5000);

    try {
      // 2. Request Connection explicitly with 'preview' network parameter
      let walletApi: MidnightWalletAPI;
      if (typeof wallet.connect === 'function') {
        walletApi = await wallet.connect('preview');
      } else if (typeof wallet.enable === 'function') {
        walletApi = await wallet.enable('preview');
      } else {
        throw new Error("1AM wallet extension does not provide a valid connect/enable API.");
      }

      this.activeWalletApi = walletApi;

      // 3. Sync Configuration dynamically from the wallet
      let config: MidnightWalletConfig | null = null;
      if (typeof walletApi.getConfiguration === 'function') {
        try {
          config = await walletApi.getConfiguration();
        } catch {
          // ignore if optional
        }
      }

      // 4. Fetch the user's unshielded address
      let address: string | null = null;
      if (typeof walletApi.getUnshieldedAddress === 'function') {
        address = await walletApi.getUnshieldedAddress();
      } else if (typeof walletApi.getAddress === 'function') {
        address = await walletApi.getAddress();
      } else if (typeof walletApi.state === 'function') {
        const state = await walletApi.state();
        address = state?.address || null;
      } else if (typeof walletApi.accounts === 'function') {
        const accs = await walletApi.accounts();
        address = accs?.[0] || null;
      }

      if (!address) {
        throw new Error("Unable to retrieve public account address from 1AM Wallet session.");
      }

      // 5. Fetch user's DUST balance
      let dustBalance: string | number | null = null;
      if (typeof walletApi.getDustBalance === 'function') {
        try {
          dustBalance = await walletApi.getDustBalance();
        } catch {
          // ignore
        }
      } else if (typeof walletApi.getBalance === 'function') {
        try {
          dustBalance = await walletApi.getBalance();
        } catch {
          // ignore
        }
      }

      // 6. Fetch user's shielded balances
      let shieldedBalances: Record<string, bigint> | null = null;
      if (typeof walletApi.getShieldedBalances === 'function') {
        try {
          shieldedBalances = await walletApi.getShieldedBalances();
        } catch {
          // ignore
        }
      }

      this.accountState = {
        isConnected: true,
        address,
        network: config?.networkId || "preview",
        walletName,
        dustBalance,
        shieldedBalances,
        config,
        proofProviderAvailable: true,
      };

      sessionStorage.setItem('midnight_wallet_address', address);
      this.notify();
      return { ...this.accountState };
    } catch (err: unknown) {
      console.error(`[1AM Wallet] Connection error:`, err);
      throw err;
    }
  }

  /**
   * Disconnect: Clears session, nullifies state, and notifies subscribers.
   */
  public disconnect(): void {
    this.activeWalletApi = null;
    this.accountState = {
      isConnected: false,
      address: null,
      network: "preview",
      walletName: null,
      dustBalance: null,
      shieldedBalances: null,
      config: null,
      proofProviderAvailable: false,
    };
    sessionStorage.removeItem('midnight_wallet_address');
    this.notify();
  }
}

export const walletService = new WalletService();
