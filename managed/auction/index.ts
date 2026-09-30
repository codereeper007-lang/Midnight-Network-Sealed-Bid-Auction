/**
 * Genuine Midnight Compact Contract Bindings & Cryptographic Helpers
 * Generated from contract/auction.compact using Compact compiler 0.31.1
 * Target SDK: @midnight-ntwrk/midnight-js-contracts
 */
import {
  persistentHash,
  CompactTypeUnsignedInteger,
  CompactTypeBytes,
  CompactTypeVector,
} from '@midnight-ntwrk/compact-runtime';
import {
  Contract,
  ledger,
  pureCircuits,
  contractReferenceLocations,
  type Witnesses,
  type Circuits,
  type Ledger,
} from './contract/index.js';

export {
  Contract,
  ledger,
  pureCircuits,
  contractReferenceLocations,
  type Witnesses,
  type Circuits,
  type Ledger,
};

export type AuctionWitnesses<PS = any> = Witnesses<PS>;
export type AuctionLedger = Ledger;
export type AuctionContract = Contract;

// Runtime compact type descriptors for deterministic cryptographic hashing
const uint64Type = new CompactTypeUnsignedInteger(18446744073709551615n, 8);
const bytes32Type = new CompactTypeBytes(32);
const vec2Bytes32Type = new CompactTypeVector(2, bytes32Type);

/**
 * Converts a hex string (with or without 0x) into a 32-byte Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const padded = clean.padStart(64, '0').slice(0, 64);
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return bytes;
}

/**
 * Converts a Uint8Array into a 0x-prefixed hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Computes deterministic Compact persistentHash commitment:
 * commitment = persistentHash<Vector<2, Bytes<32>>>([secret, persistentHash<Uint<64>>(amount)])
 * 
 * Matches the Compact smart contract circuit verification logic 100% identically.
 */
export function computeCommitmentBytes(amount: bigint, secret: Uint8Array | string): Uint8Array {
  const secretBytes = typeof secret === 'string' ? hexToBytes(secret) : secret;
  if (secretBytes.length !== 32) {
    throw new Error('Secret must be exactly 32 bytes (256-bit)');
  }

  // 1. Hash the amount: persistentHash<Uint<64>>(amount)
  const amountHash = persistentHash(uint64Type, amount);

  // 2. Hash vector [secret, amountHash]: persistentHash<Vector<2, Bytes<32>>>
  const commitment = persistentHash(vec2Bytes32Type, [secretBytes, amountHash]);
  return commitment;
}

/**
 * Computes deterministic hex commitment string.
 */
export function computeCommitment(amount: bigint, secret: Uint8Array | string): string {
  return bytesToHex(computeCommitmentBytes(amount, secret));
}

export default Contract;
