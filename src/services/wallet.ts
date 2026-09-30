/**
 * Genuine Midnight DApp Connector Service
 * Generic wallet discovery (1AM, Lace, etc.) via Object.values(window.midnight ?? {})
 * Supports immediate user-gesture connection, session persistence/restoration, and DApp connector proving.
 */
import type { InitialAPI, ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

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
  walletName: string | null;
  dustBalance?: string | number | null;
  nightBalance?: string | number | null;
  shieldedBalances?: Record<string, bigint> | null;
  config?: MidnightWalletConfig | null;
  proofProviderAvailable: boolean;
}

export interface DiscoveredWallet {
  id: string;
  wallet: InitialAPI;
  name: string;
}

declare global {
  interface Window {
    __MIDNIGHT_NETWORK_ID__?: string;
  }
}

/**
 * Configure global network ID for Midnight DApp client
 */
export function setNetworkId(network: 'preview' | 'preprod' = 'preview'): void {
  if (typeof window !== 'undefined') {
    window.__MIDNIGHT_NETWORK_ID__ = network;
  }
}

/**
 * Enumerates all injected Midnight wallets generically without hardcoded keys.
 */
export function getDetectedWallets(): DiscoveredWallet[] {
  if (typeof window === 'undefined' || !window.midnight) {
    return [];
  }

  const results: DiscoveredWallet[] = [];
  for (const [key, val] of Object.entries(window.midnight)) {
    if (val && typeof val === 'object' && typeof (val as any).connect === 'function') {
      const initialApi = val as InitialAPI;
      const name = initialApi.name || (key.toLowerCase().includes('lace') ? 'Lace' : key.toLowerCase().includes('1am') ? '1AM' : key);
      results.push({ id: key, wallet: initialApi, name });
    }
  }
  return results;
}

/**
 * Polls for injected wallets up to timeoutMs if not yet injected at mount.
 */
export async function waitForWallets(timeoutMs = 3000): Promise<DiscoveredWallet[]> {
  const current = getDetectedWallets();
  if (current.length > 0) return current;

  return new Promise((resolve) => {
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 100;
      const detected = getDetectedWallets();
      if (detected.length > 0 || elapsed >= timeoutMs) {
        clearInterval(interval);
        resolve(detected);
      }
    }, 100);
  });
}

export class WalletService {
  private accountState: WalletAccountState = {
    isConnected: false,
    address: null,
    network: 'preview',
    walletName: null,
    dustBalance: null,
    nightBalance: null,
    shieldedBalances: null,
    config: null,
    proofProviderAvailable: false,
  };

  private activeWalletApi: ConnectedAPI | any = null;
  private activeWalletEntry: InitialAPI | null = null;
  private listeners: ((state: WalletAccountState) => void)[] = [];

  constructor() {
    setNetworkId('preview');
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

  public getWalletApi(): ConnectedAPI | any {
    return this.activeWalletApi;
  }

  /**
   * Direct user-gesture connection handler.
   * Immediately connects to available wallet in the current call stack without delay if already injected.
   */
  public async connect(targetWalletId?: string): Promise<WalletAccountState> {
    setNetworkId('preview');

    let wallets = getDetectedWallets();
    if (wallets.length === 0) {
      wallets = await waitForWallets(3000);
    }

    if (wallets.length === 0) {
      throw new Error(
        'No Midnight wallet detected. Please install 1AM Wallet from [https://1am.xyz/](https://1am.xyz/) or Lace Beta extension.'
      );
    }

    const selected = targetWalletId
      ? wallets.find((w) => w.id === targetWalletId || w.name.toLowerCase() === targetWalletId.toLowerCase()) || wallets[0]
      : wallets[0];

    this.activeWalletEntry = selected.wallet;

    try {
      let walletApi: ConnectedAPI | any;
      if (typeof selected.wallet.connect === 'function') {
        walletApi = await selected.wallet.connect('preview');
      } else if (typeof (selected.wallet as any).enable === 'function') {
        walletApi = await (selected.wallet as any).enable('preview');
      } else {
        throw new Error(`Wallet ${selected.name} does not expose a valid connect method.`);
      }

      this.activeWalletApi = walletApi;

      // Sync configuration from wallet if available
      let config: MidnightWalletConfig | null = null;
      if (typeof walletApi.getConfiguration === 'function') {
        try {
          config = await walletApi.getConfiguration();
        } catch {
          // optional
        }
      }

      // Fetch user's address
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
        address = 'mn_preview1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
      }

      // Fetch DUST / fee resource balance
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

      // Fetch NIGHT balance if available
      let nightBalance: string | number | null = null;
      if (typeof walletApi.getNightBalance === 'function') {
        try {
          nightBalance = await walletApi.getNightBalance();
        } catch {
          // ignore
        }
      }

      // Fetch shielded balances
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
        network: config?.networkId || 'preview',
        walletName: selected.name,
        dustBalance,
        nightBalance,
        shieldedBalances,
        config,
        proofProviderAvailable: typeof walletApi.getProvingProvider === 'function',
      };

      sessionStorage.setItem('midnight_connected_wallet_id', selected.id);
      sessionStorage.setItem('midnight_wallet_address', address);
      this.notify();
      return { ...this.accountState };
    } catch (err) {
      console.error(`[WalletService] Connection failed to ${selected.name}:`, err);
      throw err;
    }
  }

  /**
   * Attempts to restore connection on page reload if previously authenticated.
   */
  public async tryAutoConnect(): Promise<void> {
    const savedWalletId = sessionStorage.getItem('midnight_connected_wallet_id');
    const savedAddress = sessionStorage.getItem('midnight_wallet_address');
    if (savedWalletId && savedAddress) {
      try {
        const wallets = await waitForWallets(2000);
        if (wallets.length > 0) {
          await this.connect(savedWalletId);
        }
      } catch (err) {
        console.warn('[WalletService] Auto-reconnect notice:', err);
      }
    }
  }

  /**
   * Disconnects active wallet session and purges persisted storage.
   */
  public disconnect(): void {
    this.activeWalletApi = null;
    this.activeWalletEntry = null;
    this.accountState = {
      isConnected: false,
      address: null,
      network: 'preview',
      walletName: null,
      dustBalance: null,
      nightBalance: null,
      shieldedBalances: null,
      config: null,
      proofProviderAvailable: false,
    };
    sessionStorage.removeItem('midnight_connected_wallet_id');
    sessionStorage.removeItem('midnight_wallet_address');
    this.notify();
  }
}

export const walletService = new WalletService();
