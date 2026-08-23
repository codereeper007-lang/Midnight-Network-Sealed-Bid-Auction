import { describe, it, expect, beforeEach } from 'vitest';
import {
  SealedBidAuctionContract,
  place_bid,
  reveal_bid,
  computeCommitment,
  AuctionWitnesses
} from '../managed/auction/index.ts';

describe('Midnight Sealed-Bid Auction Contract Suite (Real Compact Model)', () => {
  let contract: SealedBidAuctionContract;
  const adminKey = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  const reservePrice = 100n;

  beforeEach(() => {
    contract = new SealedBidAuctionContract();
    contract.initialize(reservePrice, adminKey);
  });

  it('1. Initializes contract with open state, reserve price, and empty commitments map', () => {
    expect(contract.state.isOpen).toBe(true);
    expect(contract.state.minReserveBid).toBe(reservePrice);
    expect(contract.state.totalBids).toBe(0n);
    expect(contract.state.commitments.size).toBe(0);
    expect(contract.state.highestBid).toBe(0n);
  });

  it('2. Places valid sealed bid: updates commitment registry and increments total bids', () => {
    const amount = 500n;
    const secret = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const commitment = computeCommitment(amount, secret);

    const result = place_bid(contract, commitment);

    expect(result.txHash).toBeDefined();
    expect(result.commitment).toBe(commitment);
    expect(contract.state.totalBids).toBe(1n);
    expect(contract.state.commitments.get(commitment)).toBe(true);
  });

  it('3. Rejects duplicate commitments to prevent replay / double bidding', () => {
    const commitment = computeCommitment(300n, "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef");

    place_bid(contract, commitment);
    expect(contract.state.totalBids).toBe(1n);

    expect(() => {
      place_bid(contract, commitment);
    }).toThrowError(/Bid commitment has already been registered/);
  });

  it('4. Successfully reveals valid bid, verifies commitment preimage, and updates highest bid', () => {
    const amount = 1500n;
    const secret = "0xfeedbeef12345678feedbeef12345678feedbeef12345678feedbeef12345678";
    const commitment = computeCommitment(amount, secret);

    place_bid(contract, commitment);

    const witness: AuctionWitnesses = {
      getBidAmount: () => amount,
      getBidderSecret: () => secret,
      getBidderAddress: () => "mn_preview1winneraddress",
    };

    const revealResult = reveal_bid(contract, witness);

    expect(revealResult.isWinner).toBe(true);
    expect(revealResult.amount).toBe(amount);
    expect(contract.state.highestBid).toBe(amount);
    expect(contract.state.winner).toBe("mn_preview1winneraddress");
  });

  it('5. Rejects reveal if computed commitment does not match any registered bid', () => {
    const uncommittedWitness: AuctionWitnesses = {
      getBidAmount: () => 2000n,
      getBidderSecret: () => "0x9999999999999999999999999999999999999999999999999999999999999999",
    };

    expect(() => {
      reveal_bid(contract, uncommittedWitness);
    }).toThrowError(/Invalid reveal: Commitment does not exist/);
  });

  it('6. Rejects reveal if amount is strictly below the minimum reserve', () => {
    const lowAmount = 50n; // Reserve is 100n
    const secret = "0x8888888888888888888888888888888888888888888888888888888888888888";
    const commitment = computeCommitment(lowAmount, secret);

    place_bid(contract, commitment);

    const witness: AuctionWitnesses = {
      getBidAmount: () => lowAmount,
      getBidderSecret: () => secret,
    };

    expect(() => {
      reveal_bid(contract, witness);
    }).toThrowError(/strictly below the required minimum reserve/);
  });

  it('7. Privacy Guarantee: Raw bid amount and secret never leak prior to reveal', () => {
    const secretBid = 999999n;
    const secretEntropy = "0x7777777777777777777777777777777777777777777777777777777777777777";
    const commitment = computeCommitment(secretBid, secretEntropy);

    place_bid(contract, commitment);

    const serialized = JSON.stringify(contract.state, (_, v) => typeof v === 'bigint' ? v.toString() : v);
    expect(serialized).not.toContain(secretBid.toString());
    expect(serialized).not.toContain(secretEntropy);
    expect(contract.state.commitments.get(commitment)).toBe(true);
  });
});
