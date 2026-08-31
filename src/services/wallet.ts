/**
 * Genuine Midnight DApp Connector Service (1AM Wallet & Lace Beta)
 * Connects directly to window.midnight.mn1am or window.midnight.mnLace
 * STRICT: Zero fallback to mock addresses.
 */

export interface WalletAccountState {
  isConnected: boolean;
  address: string | null;
  network: string;
  walletName: '1AM' | 'Lace' | null;
  proofProviderAvailable: boolean;
}

export interface MidnightDAppConnectorAPI {
  enable: () => Promise<{
    state: () => Promise<{ address: string; coinPublicKey?: string }>;
    prove?: (circuitId: string, privateInputs: unknown) => Promise<unknown>;
    submitTx?: (tx: unknown) => Promise<string>;
  }>;
  isEnabled: () => Promise<boolean>;
}

declare global {
  interface Window {
    midnight?: {
      mn1am?: MidnightDAppConnectorAPI;
      mnLace?: MidnightDAppConnectorAPI;
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

export class WalletService {
  private accountState: WalletAccountState = {
    isConnected: false,
    address: null,
    network: "preview",
    walletName: null,
    proofProviderAvailable: false,
  };

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

  /**
   * Connect to 1AM Wallet or Lace Beta extension.
   * STRICT: Throws an error if no genuine extension is detected.
   */
  public async connect(): Promise<WalletAccountState> {
    setNetworkId("preview");

    // 1. Detect 1AM Wallet first (primary), then Lace Beta
    const mn1am = window.midnight?.mn1am;
    const mnLace = window.midnight?.mnLace;

    let activeConnector: MidnightDAppConnectorAPI | undefined;
    let walletType: '1AM' | 'Lace' | null = null;

    if (mn1am && typeof mn1am.enable === 'function') {
      activeConnector = mn1am;
      walletType = '1AM';
    } else if (mnLace && typeof mnLace.enable === 'function') {
      activeConnector = mnLace;
      walletType = 'Lace';
    }

    if (!activeConnector || !walletType) {
      throw new Error(
        "1AM Wallet Extension (or Midnight Lace Beta) not detected in browser. Please install the Midnight 1AM Wallet extension to connect."
      );
    }

    try {
      const session = await activeConnector.enable();
      const state = await session.state();
      
      if (!state || !state.address) {
        throw new Error("Failed to retrieve public account address from Midnight wallet.");
      }

      this.accountState = {
        isConnected: true,
        address: state.address,
        network: "preview",
        walletName: walletType,
        proofProviderAvailable: true,
      };

      sessionStorage.setItem('midnight_wallet_address', state.address);
      this.notify();
      return { ...this.accountState };
    } catch (err) {
      console.error(`[Midnight Wallet] ${walletType} connection rejected or failed:`, err);
      throw err;
    }
  }

  /**
   * Disconnect: Clears session, nullifies state, and notifies subscribers.
   */
  public disconnect(): void {
    this.accountState = {
      isConnected: false,
      address: null,
      network: "preview",
      walletName: null,
      proofProviderAvailable: false,
    };
    sessionStorage.removeItem('midnight_wallet_address');
    this.notify();
  }
}

export const walletService = new WalletService();
