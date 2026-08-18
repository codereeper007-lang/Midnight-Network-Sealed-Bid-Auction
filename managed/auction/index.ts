/**
 * Managed TypeScript bindings for Midnight Compact Contract: auction.compact
 * Generated for Midnight Preview Testnet
 */

export interface AuctionLedgerState {
  isOpen: boolean;
  totalBids: bigint;
  minReserveBid: bigint;
  highestBidCommitment: string;
  nullifiers: Map<string, boolean>;
  auctioneer: string;
}

export interface AuctionWitnesses {
  getBidAmount: () => bigint;
  getBidderSecret: () => string;
  getBidderSalt: () => string;
}

export class SealedBidAuctionContract {
  public state: AuctionLedgerState;
  public witnesses?: AuctionWitnesses;

  constructor(initialState?: Partial<AuctionLedgerState>, witnesses?: AuctionWitnesses) {
    this.state = {
      isOpen: initialState?.isOpen ?? true,
      totalBids: initialState?.totalBids ?? 0n,
      minReserveBid: initialState?.minReserveBid ?? 100n,
      highestBidCommitment: initialState?.highestBidCommitment ?? "0x0000000000000000000000000000000000000000000000000000000000000000",
      nullifiers: initialState?.nullifiers ?? new Map<string, boolean>(),
      auctioneer: initialState?.auctioneer ?? "0x1111111111111111111111111111111111111111111111111111111111111111",
    };
    this.witnesses = witnesses;
  }

  public initialize(reserve: bigint, adminPubKey: string): { txHash: string; state: AuctionLedgerState } {
    this.state.isOpen = true;
    this.state.minReserveBid = reserve;
    this.state.auctioneer = adminPubKey;
    this.state.totalBids = 0n;
    this.state.highestBidCommitment = "0x0000000000000000000000000000000000000000000000000000000000000000";
    return {
      txHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      state: { ...this.state },
    };
  }

  public submitBid(customWitnesses?: AuctionWitnesses): {
    txHash: string;
    nullifier: string;
    bidCommitment: string;
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
    const salt = witness.getBidderSalt();

    if (amount < this.state.minReserveBid) {
      throw new Error("Bid amount is strictly below the required minimum reserve");
    }

    // Persistent hash calculation for nullifier: H(secret)
    const nullifier = "nullifier_" + this.pseudoHash(secret);

    if (this.state.nullifiers.get(nullifier)) {
      throw new Error("Double-bidding error: This bidder credential has already cast a bid");
    }

    // Bid commitment: H(secret, salt, H(amount))
    const bidCommitment = "commitment_" + this.pseudoHash(`${secret}_${salt}_${amount.toString()}`);

    // Disclose to public ledger
    this.state.nullifiers.set(nullifier, true);
    this.state.totalBids += 1n;
    this.state.highestBidCommitment = bidCommitment;

    return {
      txHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      nullifier,
      bidCommitment,
      state: { ...this.state, nullifiers: new Map(this.state.nullifiers) },
    };
  }

  public closeAuction(): { txHash: string; state: AuctionLedgerState } {
    this.state.isOpen = false;
    return {
      txHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      state: { ...this.state },
    };
  }

  private pseudoHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return hex.repeat(8).slice(0, 64);
  }
}

export default SealedBidAuctionContract;
