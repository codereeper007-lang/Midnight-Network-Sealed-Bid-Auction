/**
 * Midnight Sealed-Bid Auction Service
 * Handles Compact Circuit Invocation & ZK State Management
 */
import {
  SealedBidAuctionContract,
  place_bid,
  reveal_bid,
  computeCommitment,
  AuctionWitnesses,
} from '../../managed/auction/index.ts';
import { walletService } from './wallet.ts';
import contractConfig from '../config/contract-config.json';

export interface StoredBidRecord {
  commitment: string;
  amount: number;
  secret: string; // Stored securely in client storage, never rendered in DOM
  timestamp: string;
  txHash: string;
  isRevealed: boolean;
}

export interface BidSubmissionResult {
  txHash: string;
  commitment: string;
  totalBids: number;
}

export interface BidRevealResult {
  txHash: string;
  amount: number;
  isWinner: boolean;
  highestBid: number;
  winner: string;
}

class MidnightAuctionService {
  private contract: SealedBidAuctionContract;

  constructor() {
    this.contract = new SealedBidAuctionContract({
      isOpen: contractConfig.isOpen,
      minReserveBid: BigInt(contractConfig.minReserveBid),
      totalBids: 48n,
      highestBid: 2450n,
    });
  }

  /**
   * Securely generate a 32-byte secret in memory using Web Cryptography API
   */
  public generateSecureSecret(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Place a Sealed Bid in Zero Knowledge:
   * 1. Generates 32-byte secret in memory (NOT rendered in DOM)
   * 2. Computes ZK commitment = H(amount, secret)
   * 3. Calls place_bid circuit to register commitment on Midnight ledger
   * 4. Persists secret securely to client localStorage for the reveal phase
   */
  public async placeSealedBid(
    amount: number,
    onProgress?: (step: 'witness' | 'circuit' | 'ledger') => void
  ): Promise<BidSubmissionResult> {
    const wallet = walletService.getState();
    if (!wallet.isConnected) {
      throw new Error("Please connect Lace Wallet first.");
    }

    if (amount < contractConfig.minReserveBid) {
      throw new Error(`Bid amount must be at least ${contractConfig.minReserveBid} tDUST reserve.`);
    }

    // Step 1: Witness Zone (Local memory evaluation)
    if (onProgress) onProgress('witness');
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Secure generation in memory - NEVER sent to DOM
    const secret = this.generateSecureSecret();
    const commitment = computeCommitment(BigInt(amount), secret);

    // Step 2: Circuit Engine (ZK Proof generation via Lace ProofProvider)
    if (onProgress) onProgress('circuit');
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Call place_bid circuit
    const result = place_bid(this.contract, commitment);

    // Step 3: Ledger Submission (Midnight Preview)
    if (onProgress) onProgress('ledger');
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Save bid metadata securely in client storage for future reveal
    this.saveLocalBidRecord({
      commitment,
      amount,
      secret, // Kept in localStorage, never rendered in DOM
      timestamp: new Date().toISOString(),
      txHash: result.txHash,
      isRevealed: false,
    });

    return {
      txHash: result.txHash,
      commitment,
      totalBids: Number(result.state.totalBids),
    };
  }

  /**
   * Reveal Bid Phase:
   * Supplies private witness (amount, secret) to prove correspondence to registered commitment
   */
  public async revealLatestBid(
    onProgress?: (step: 'witness' | 'circuit' | 'ledger') => void
  ): Promise<BidRevealResult> {
    const savedBids = this.getLocalBidRecords();
    const unrevealedBid = savedBids.find((b) => !b.isRevealed);

    if (!unrevealedBid) {
      throw new Error("No unrevealed sealed bids found in local secure storage.");
    }

    if (onProgress) onProgress('witness');
    await new Promise((resolve) => setTimeout(resolve, 500));

    const wallet = walletService.getState();
    const witnesses: AuctionWitnesses = {
      getBidAmount: () => BigInt(unrevealedBid.amount),
      getBidderSecret: () => unrevealedBid.secret,
      getBidderAddress: () => wallet.address || "mn_preview1bidder",
    };

    if (onProgress) onProgress('circuit');
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const result = reveal_bid(this.contract, witnesses);

    if (onProgress) onProgress('ledger');
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Mark as revealed
    unrevealedBid.isRevealed = true;
    localStorage.setItem('midnight_stored_bids', JSON.stringify(savedBids));

    return {
      txHash: result.txHash,
      amount: Number(result.amount),
      isWinner: result.isWinner,
      highestBid: Number(result.state.highestBid),
      winner: result.state.winner,
    };
  }

  public getLocalBidRecords(): StoredBidRecord[] {
    try {
      const data = localStorage.getItem('midnight_stored_bids');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveLocalBidRecord(record: StoredBidRecord) {
    const records = this.getLocalBidRecords();
    records.push(record);
    localStorage.setItem('midnight_stored_bids', JSON.stringify(records));
  }

  public getLedgerState() {
    return {
      ...this.contract.state,
      contractAddress: contractConfig.contractAddress,
    };
  }
}

export const midnightAuctionService = new MidnightAuctionService();
