import { describe, it, expect, beforeEach } from 'vitest';
import { SealedBidAuctionContract, AuctionWitnesses } from '../managed/auction/index.ts';

describe('Midnight Sealed-Bid Auction Contract Suite', () => {
  let contract: SealedBidAuctionContract;
  const adminKey = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const reservePrice = 100n;

  beforeEach(() => {
    contract = new SealedBidAuctionContract();
    contract.initialize(reservePrice, adminKey);
  });

  it('1. Initializes contract with active state, reserve price, and empty nullifier set', () => {
    expect(contract.state.isOpen).toBe(true);
    expect(contract.state.minReserveBid).toBe(reservePrice);
    expect(contract.state.totalBids).toBe(0n);
    expect(contract.state.nullifiers.size).toBe(0);
    expect(contract.state.auctioneer).toBe(adminKey);
  });

  it('2. Submits valid sealed bid: updates nullifier registry, total bids counter, and commitment', () => {
    const witness: AuctionWitnesses = {
      getBidAmount: () => 500n,
      getBidderSecret: () => "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      getBidderSalt: () => "0x9999999999999999999999999999999999999999999999999999999999999999",
    };

    const result = contract.submitBid(witness);

    expect(result.txHash).toBeDefined();
    expect(result.nullifier).toBeDefined();
    expect(result.bidCommitment).toBeDefined();
    expect(contract.state.totalBids).toBe(1n);
    expect(contract.state.nullifiers.get(result.nullifier)).toBe(true);
    expect(contract.state.highestBidCommitment).toBe(result.bidCommitment);
  });

  it('3. Rejects bids strictly below the minimum reserve price', () => {
    const belowReserveWitness: AuctionWitnesses = {
      getBidAmount: () => 50n, // Reserve is 100n
      getBidderSecret: () => "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      getBidderSalt: () => "0x8888888888888888888888888888888888888888888888888888888888888888",
    };

    expect(() => {
      contract.submitBid(belowReserveWitness);
    }).toThrowError(/strictly below the required minimum reserve/);

    expect(contract.state.totalBids).toBe(0n);
  });

  it('4. Prevents double-bidding when the same bidder secret is used twice', () => {
    const secret = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const witness1: AuctionWitnesses = {
      getBidAmount: () => 200n,
      getBidderSecret: () => secret,
      getBidderSalt: () => "0x1111111111111111111111111111111111111111111111111111111111111111",
    };

    // First bid succeeds
    const res1 = contract.submitBid(witness1);
    expect(contract.state.totalBids).toBe(1n);
    expect(contract.state.nullifiers.get(res1.nullifier)).toBe(true);

    // Second bid with identical secret is rejected by circuit nullifier constraint
    const witness2: AuctionWitnesses = {
      getBidAmount: () => 300n,
      getBidderSecret: () => secret,
      getBidderSalt: () => "0x2222222222222222222222222222222222222222222222222222222222222222",
    };

    expect(() => {
      contract.submitBid(witness2);
    }).toThrowError(/Double-bidding error/);

    expect(contract.state.totalBids).toBe(1n);
  });

  it('5. Prevents bids when auction has been closed by admin', () => {
    contract.closeAuction();
    expect(contract.state.isOpen).toBe(false);

    const witness: AuctionWitnesses = {
      getBidAmount: () => 1000n,
      getBidderSecret: () => "0x4444444444444444444444444444444444444444444444444444444444444444",
      getBidderSalt: () => "0x5555555555555555555555555555555555555555555555555555555555555555",
    };

    expect(() => {
      contract.submitBid(witness);
    }).toThrowError(/Auction is currently closed/);
  });

  it('6. Privacy Guarantee: Raw bid amount is never disclosed to public ledger state', () => {
    const rawBidAmount = 987654n;
    const witness: AuctionWitnesses = {
      getBidAmount: () => rawBidAmount,
      getBidderSecret: () => "0x7777777777777777777777777777777777777777777777777777777777777777",
      getBidderSalt: () => "0x6666666666666666666666666666666666666666666666666666666666666666",
    };

    contract.submitBid(witness);

    // Ledger state inspection: only commitment hash and nullifier are public
    const serializedState = JSON.stringify(contract.state, (_, v) => typeof v === 'bigint' ? v.toString() : v);
    expect(serializedState).not.toContain(rawBidAmount.toString());
    expect(contract.state.highestBidCommitment).toMatch(/^commitment_/);
  });
});
