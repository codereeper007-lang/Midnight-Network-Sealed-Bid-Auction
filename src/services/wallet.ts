/**
 * Genuine Midnight DApp Connector Service (1AM Wallet & Lace Beta)
 * Features asynchronous extension injection polling and strict Preview Testnet targeting.
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
  enable?: (network?: string) => Promise<{
    state?: () => Promise<{ address: string; coinPublicKey?: string }>;
    accounts?: () => Promise<string[]>;
    prove?: (circuitId: string, privateInputs: unknown) => Promise<unknown>;
    submitTx?: (tx: unknown) => Promise<string>;
  }>;
  connect?: (network?: string) => Promise<{
    state?: () => Promise<{ address: string; coinPublicKey?: string }>;
    accounts?: () => Promise<string[]>;
    prove?: (circuitId: string, privateInputs: unknown) => Promise<unknown>;
    submitTx?: (tx: unknown) => Promise<string>;
  }>;
  isEnabled?: () => Promise<boolean>;
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

/**
 * Polling Helper: Waits for asynchronous 1AM / Midnight extension DOM injection
 */
export async function waitForMidnightExtension(timeoutMs = 3000): Promise<{
  connector: MidnightDAppConnectorAPI;
  walletType: '1AM' | 'Lace';
}> {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      const mn1am = window.midnight?.mn1am;
      const mnLace = window.midnight?.mnLace;

      if (mn1am) {
        clearInterval(checkInterval);
        resolve({ connector: mn1am, walletType: '1AM' });
      } else if (mnLace) {
        clearInterval(checkInterval);
        resolve({ connector: mnLace, walletType: 'Lace' });
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(checkInterval);
        reject(
          new Error("1AM Wallet Extension not detected. Please install it from https://1am.xyz/")
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
   * Connect to 1AM Wallet with asynchronous injection polling and Preview network targeting.
   */
  public async connect(): Promise<WalletAccountState> {
    setNetworkId("preview");

    // 1. Await asynchronous injection via polling
    const { connector, walletType } = await waitForMidnightExtension(3000);

    try {
      // 2. Establish connection explicitly targeting the 'preview' network
      let session;
      if (typeof connector.connect === 'function') {
        session = await connector.connect('preview');
      } else if (typeof connector.enable === 'function') {
        session = await connector.enable('preview');
      } else {
        throw new Error("Detected Midnight extension does not provide a standard connect/enable method.");
      }

      // 3. Extract public address from session
      let address: string | null = null;
      if (session && typeof session.state === 'function') {
        const state = await session.state();
        address = state?.address || null;
      } else if (session && typeof session.accounts === 'function') {
        const accounts = await session.accounts();
        address = accounts?.[0] || null;
      }

      if (!address) {
        throw new Error("Unable to retrieve public account address from Midnight 1AM Wallet session.");
      }

      this.accountState = {
        isConnected: true,
        address,
        network: "preview",
        walletName: walletType,
        proofProviderAvailable: true,
      };

      sessionStorage.setItem('midnight_wallet_address', address);
      this.notify();
      return { ...this.accountState };
    } catch (err: unknown) {
      console.error(`[Midnight Wallet] ${walletType} connection error:`, err);
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
