/**
 * Web Cryptography & Entropy Utilities for Midnight Network Sealed-Bid Auctions
 * Uses standard Web Crypto API (crypto.getRandomValues) for secure witness generation.
 */

/**
 * Generates a 32-byte (256-bit) cryptographically secure random secret in memory.
 * Never exposed to the DOM.
 */
export function generateSecureEntropy(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a 32-byte Uint8Array cryptographically secure random secret.
 */
export function generateSecureEntropyBytes(): Uint8Array {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Converts a hex string into a Uint8Array.
 */
export function hexToUint8Array(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const padded = clean.length % 2 === 0 ? clean : '0' + clean;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Converts a Uint8Array into a hex string with 0x prefix.
 */
export function uint8ArrayToHex(bytes: Uint8Array): string {
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}
