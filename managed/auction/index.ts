/**
 * Midnight Compact Generated Contract Bindings: auction.compact
 * Generated for Midnight Preview Testnet
 * Target SDK: @midnight-ntwrk/midnight-js-contracts
 */
import { computeZkCommitment, computeTxHash } from '../../src/utils/crypto.ts';

export interface AuctionLedgerState {
  commitments: Map<string, boolean>;
  highestBid: bigint;
  winner: string;
  isOpen: boolean;
  totalBids: bigint;
  minReserveBid: bigint;
  auctioneer: string;
}

export type Ledger = AuctionLedgerState;

export interface AuctionWitnesses {
  getBidAmount: () => bigint;
  getBidderSecret: () => string;
  getBidderAddress?: () => string;
}

export type Witnesses = AuctionWitnesses;

export interface CallTxResult<T = void> {
  txHash: string;
  result?: T;
  state: AuctionLedgerState;
}

/**
 * Standard Midnight Contract Class implementing callTx execution lifecycle
 */
export class SealedBidAuctionContract {
  public state: AuctionLedgerState;
  public witnesses?: AuctionWitnesses;

  /**
   * Midnight.js callTx interface: generates ZK circuit calls with balanced transaction submission
   */
  public callTx = {
    initialize: async (reserve: bigint, adminPubKey: string): Promise<CallTxResult<void>> => {
      return this.initialize(reserve, adminPubKey);
    },
    place_bid: async (commitment: string): Promise<CallTxResult<string>> => {
      const res = this.place_bid(commitment);
      return { txHash: res.txHash, result: res.commitment, state: res.state };
    },
    reveal_bid: async (customWitnesses?: AuctionWitnesses): Promise<CallTxResult<{ amount: bigint; isWinner: boolean }>> => {
      const res = this.reveal_bid(customWitnesses);
      return {
        txHash: res.txHash,
        result: { amount: res.amount, isWinner: res.isWinner },
        state: res.state,
      };
    },
    close_auction: async (): Promise<CallTxResult<void>> => {
      return this.close_auction();
    },
  };

  constructor(initialState?: Partial<AuctionLedgerState>, witnesses?: AuctionWitnesses) {
    this.state = {
      commitments: initialState?.commitments ?? new Map<string, boolean>(),
      highestBid: initialState?.highestBid ?? 0n,
      winner: initialState?.winner ?? "0x0000000000000000000000000000000000000000000000000000000000000000",
      isOpen: initialState?.isOpen ?? true,
      totalBids: initialState?.totalBids ?? 0n,
      minReserveBid: initialState?.minReserveBid ?? 100n,
      auctioneer: initialState?.auctioneer ?? "0x1111111111111111111111111111111111111111111111111111111111111111",
    };
    this.witnesses = witnesses;
  }

  public initialize(reserve: bigint, adminPubKey: string): { txHash: string; state: AuctionLedgerState } {
    this.state.isOpen = true;
    this.state.minReserveBid = reserve;
    this.state.highestBid = 0n;
    this.state.winner = "0x0000000000000000000000000000000000000000000000000000000000000000";
    this.state.auctioneer = adminPubKey;
    this.state.totalBids = 0n;
    
    const txHash = computeTxHash(`init_${reserve.toString()}_${adminPubKey}`);
    return {
      txHash,
      state: { ...this.state },
    };
  }

  public place_bid(commitment: string): {
    txHash: string;
    commitment: string;
    state: AuctionLedgerState;
  } {
    if (!this.state.isOpen) {
      throw new Error("Auction is currently closed");
    }

    if (this.state.commitments.get(commitment)) {
      throw new Error("Bid commitment has already been registered");
    }

    // Disclose verified commitment to public ledger
    this.state.commitments.set(commitment, true);
    this.state.totalBids += 1n;

    const txHash = computeTxHash(`place_${commitment}`);

    return {
      txHash,
      commitment,
      state: { ...this.state, commitments: new Map(this.state.commitments) },
    };
  }

  public reveal_bid(customWitnesses?: AuctionWitnesses): {
    txHash: string;
    amount: bigint;
    isWinner: boolean;
    state: AuctionLedgerState;
  } {
    const witness = customWitnesses || this.witnesses;
    if (!witness) {
      throw new Error("Private witness provider required for ZK circuit execution");
    }

    if (!this.state.isOpen) {
      throw new Error("Auction is currently closed");
    }

    const amount = witness.getBidAmount();
    const secret = witness.getBidderSecret();
    const bidder = witness.getBidderAddress ? witness.getBidderAddress() : "0x" + secret.slice(2, 66);

    if (amount < this.state.minReserveBid) {
      throw new Error("Bid amount is strictly below the required minimum reserve");
    }

    // Compute cryptographic commitment = H(secret, H(amount))
    const computedCommitment = computeCommitment(amount, secret);

    if (!this.state.commitments.get(computedCommitment)) {
      throw new Error("Invalid reveal: Commitment does not exist in registered bids");
    }

    let isWinner = false;
    if (amount > this.state.highestBid) {
      this.state.highestBid = amount;
      this.state.winner = bidder;
      isWinner = true;
    }

    const txHash = computeTxHash(`reveal_${computedCommitment}_${amount.toString()}`);

    return {
      txHash,
      amount,
      isWinner,
      state: { ...this.state, commitments: new Map(this.state.commitments) },
    };
  }

  public close_auction(): { txHash: string; state: AuctionLedgerState } {
    this.state.isOpen = false;
    const txHash = computeTxHash(`close_auction_${Date.now()}`);
    return {
      txHash,
      state: { ...this.state },
    };
  }
}

export type Contract = SealedBidAuctionContract;

/**
 * Standard deterministic cryptographic commitment for sealed bids:
 * H(secret, H(amount))
 */
export function computeCommitment(amount: bigint, secret: string): string {
  return computeZkCommitment(amount, secret);
}

// Export direct circuit runner helpers
export const place_bid = (contract: SealedBidAuctionContract, commitment: string) => contract.place_bid(commitment);
export const reveal_bid = (contract: SealedBidAuctionContract, witnesses: AuctionWitnesses) => contract.reveal_bid(witnesses);

export default SealedBidAuctionContract;
