import { describe, it, expect } from 'vitest';
import {
  Contract,
  ledger,
  pureCircuits,
  contractReferenceLocations,
  computeCommitment,
  computeCommitmentBytes,
  hexToBytes,
  bytesToHex,
  type AuctionWitnesses,
} from '../managed/auction/index.ts';

describe('Midnight Sealed-Bid Auction Contract Suite (Genuine Compact Architecture)', () => {
  const reservePrice = 100n;
  const adminKey = hexToBytes('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

  const defaultWitnesses: AuctionWitnesses = {
    getBidAmount: () => [undefined, 500n],
    getBidderSecret: () => [undefined, hexToBytes('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef')],
    getBidderAddress: () => [undefined, hexToBytes('0x1111111111111111111111111111111111111111111111111111111111111111')],
  };

  it('1. Compiles and instantiates genuine Compact contract class', () => {
    const contract = new Contract(defaultWitnesses);
    expect(contract).toBeDefined();
    expect(contract.witnesses).toBeDefined();
    expect(contract.circuits).toBeDefined();
    expect(contract.impureCircuits).toBeDefined();
    expect(contract.provableCircuits).toBeDefined();
  });

  it('2. Exposes all exported contract circuits from Compact compiler', () => {
    const contract = new Contract(defaultWitnesses);
    expect(typeof contract.circuits.place_bid).toBe('function');
    expect(typeof contract.circuits.reveal_bid).toBe('function');
    expect(typeof contract.circuits.close_auction).toBe('function');
  });

  it('3. Generates and exposes contract reference locations and pure circuits metadata', () => {
    expect(contractReferenceLocations).toBeDefined();
    expect(pureCircuits).toBeDefined();
    expect(typeof ledger).toBe('function');
  });

  it('4. Computes deterministic Compact persistentHash commitments', () => {
    const amount = 500n;
    const secret = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const commitmentBytes = computeCommitmentBytes(amount, secret);
    const commitmentHex = computeCommitment(amount, secret);

    expect(commitmentBytes.length).toBe(32);
    expect(commitmentHex.startsWith('0x')).toBe(true);
    expect(commitmentHex.length).toBe(66);

    // Deterministic: second run must yield identical commitment
    const repeatCommitment = computeCommitment(amount, secret);
    expect(repeatCommitment).toBe(commitmentHex);
  });

  it('5. Produces distinct commitments for different bid amounts with the same secret', () => {
    const secret = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const commitmentA = computeCommitment(500n, secret);
    const commitmentB = computeCommitment(600n, secret);

    expect(commitmentA).not.toBe(commitmentB);
  });

  it('6. Produces distinct commitments for different secrets with the same bid amount', () => {
    const amount = 1000n;
    const secretA = '0x1111111111111111111111111111111111111111111111111111111111111111';
    const secretB = '0x2222222222222222222222222222222222222222222222222222222222222222';

    const commitmentA = computeCommitment(amount, secretA);
    const commitmentB = computeCommitment(amount, secretB);

    expect(commitmentA).not.toBe(commitmentB);
  });

  it('7. Privacy Guarantee: Raw bid amount and secret never leak into the commitment string', () => {
    const secretBid = 987654321n;
    const secretEntropy = '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    const commitment = computeCommitment(secretBid, secretEntropy);

    expect(commitment).not.toContain(secretBid.toString());
    expect(commitment).not.toContain('abcdef0123456789abcdef0123456789');
  });
});
