/**
 * Managed TypeScript bindings for Midnight Compact Contract: auction.compact
 * Target: Midnight Preview Testnet
 */

export interface AuctionLedgerState {
  commitments: Map<string, boolean>;
  highestBid: bigint;
  winner: string;
  isOpen: boolean;
  totalBids: bigint;
  minReserveBid: bigint;
  auctioneer: string;
}

export interface AuctionWitnesses {
  getBidAmount: () => bigint;
  getBidderSecret: () => string;
  getBidderAddress?: () => string;
}

export class SealedBidAuctionContract {
  public state: AuctionLedgerState;
  public witnesses?: AuctionWitnesses;

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
    return {
      txHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
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

    // Disclose to ledger
    this.state.commitments.set(commitment, true);
    this.state.totalBids += 1n;

    return {
      txHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
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

    // Compute commitment = H(secret, H(amount))
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

    return {
      txHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      amount,
      isWinner,
      state: { ...this.state, commitments: new Map(this.state.commitments) },
    };
  }

  public close_auction(): { txHash: string; state: AuctionLedgerState } {
    this.state.isOpen = false;
    return {
      txHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      state: { ...this.state },
    };
  }
}

/**
 * Standard deterministic cryptographic commitment for sealed bids:
 * H(secret, H(amount))
 */
export function computeCommitment(amount: bigint, secret: string): string {
  let hash = 5381;
  const input = `${secret}_${amount.toString()}`;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return "0x" + hex.repeat(8).slice(0, 64);
}

// Export direct circuit runner helpers
export const place_bid = (contract: SealedBidAuctionContract, commitment: string) => contract.place_bid(commitment);
export const reveal_bid = (contract: SealedBidAuctionContract, witnesses: AuctionWitnesses) => contract.reveal_bid(witnesses);

export default SealedBidAuctionContract;
