# 🛡️ Midnight Network Sealed-Bid Auction: System Architecture & Feasibility Proposal

---

## 1. Product and Users

### What is the dApp?
The **Midnight Zero-Knowledge Sealed-Bid Auction** is a decentralized, privacy-preserving auction protocol deployed on the **Midnight Preview Testnet**. In a classic open English or Dutch auction on transparent blockchains (e.g., Ethereum, Cardano), every bid is immediately broadcast in plain text. This leads to critical market failures:
- **Bid Sniping & Front-Running:** Malicious participants or MEV searchers observe incoming transactions and outbid competitors by minimal increments at the last second.
- **Predatory Pricing & Information Leakage:** Competitors discover private valuations, trade secrets, and budget constraints of other bidders.
- **Collusion:** Transparency allows bidders to coordinate and artificially suppress sale prices.

Our Sealed-Bid Auction dApp solves these market inefficiencies by enforcing a two-phase cryptographic lifecycle:
1. **Sealed Commitment Phase:** Bidders submit cryptographically binding commitments $H(\text{bidAmount}, \text{bidderSecret})$ generated inside their local client runtime. The raw bid amount and identity remain completely secret in the bidder's local private Witness zone.
2. **ZK Verification & Reveal Phase:** Bidders prove in Zero-Knowledge that their revealed bid corresponds to the committed hash and satisfies reserve thresholds. The protocol verifies validity, updates the winning bid, and records the winner without exposing unrevealed competing bids.

### Who Uses It?
- **Enterprise & Government Procurement:** Public and private sector organizations requiring confidential tenders where bids must remain strictly sealed until the tender closing window.
- **High-Value Real-World Assets (RWA) & Art:** High-net-worth individuals and institutions acquiring physical or digital assets without signaling their financial positions or maximum willingness to pay to the public market.
- **DeFi Liquidations & OTC Blocks:** Institutional traders executing large volume debt auctions or token liquidations without causing market-wide panic or cascading price impact.

---

## 2. Why Midnight?

Zero-Knowledge smart contracts on the **Midnight Network** are uniquely engineered for this application due to Midnight's hybrid **dual-state architecture (Private Witness + Public Ledger)** and the **Compact domain-specific language**.

### Critical ZK Properties Enforced:
1. **Absolute Pre-Reveal Confidentiality:** The user's bid amount is never sent across RPC endpoints or recorded in transaction calldata. It is processed exclusively within the local client-side proving system.
2. **Non-Interactive Zero-Knowledge Proofs (ZK-SNARKs):** Instead of trusting a centralized auctioneer or hardware enclave, the blockchain mathematically verifies cryptographic proofs that:
   - The bid is greater than or equal to the minimum reserve threshold ($bidAmount \ge minReserve$).
   - The nullifier is uniquely derived from the bidder's secret, preventing Sybil attacks and double-bidding without linking to public wallet addresses.
3. **Selective State Disclosure via `disclose()`:** Compact allows granular control over data visibility. Only the minimum necessary computational results (e.g., valid commitment hashes, nullifiers, and winning tallies) transition across the boundary into the public ledger.

---

## 3. Data Model: Public Ledger vs. Private Witness

The application strictly separates data across three cryptographic boundaries:

```mermaid
flowchart LR
    subgraph PrivateZone["1. The Witness (Private Client Zone)"]
        Bid["bidAmount: Uint64 (Secret valuation)"]
        Secret["bidderSecret: Bytes32 (Private entropy)"]
    end

    subgraph CircuitZone["2. The Circuit (ZK Proof Engine)"]
        Verify["Verify: H(bidAmount, bidderSecret) == stored_commitment"]
        Compare["Compare: bidAmount > highestBid"]
    end

    subgraph LedgerZone["3. The Ledger (Public Blockchain Zone)"]
        Comm["commitments: Set<Bytes32>"]
        High["highestBid: Uint64"]
        Win["winner: Bytes32"]
    end

    PrivateZone -->|Private Inputs| CircuitZone
    CircuitZone -->|disclose(commitment, highestBid, winner)| LedgerZone
```

### 1. Private Witness Zone (Client-Only Memory)
- **`bidAmount: Uint64`**: The exact numerical amount in tDUST / token units. Generated and held exclusively in the client's local memory.
- **`bidderSecret: Bytes32`**: High-entropy 256-bit cryptographic salt generated securely via `crypto.getRandomValues()`. Never rendered in DOM or sent across the network.

### 2. The Circuit (ZK Prover & Verifier)
- **`place_bid(commitment: Bytes[32])`**: Evaluates commitment validity and discloses the 32-byte hash commitment to the ledger.
- **`reveal_bid()`**: Takes the private witness inputs `(bidAmount, bidderSecret)`, computes $H(\text{bidAmount}, \text{bidderSecret})$, asserts equality with the committed hash, checks if $bidAmount > highestBid$, and updates the winning state.

### 3. Public Ledger Zone (On-Chain State)
- **`commitments: Set<Bytes[32]>` / `Map<Bytes[32], Boolean>`**: Collection of valid, cryptographically binding bid commitments placed during the auction.
- **`highestBid: Uint64`**: The verified highest revealed bid amount disclosed after circuit resolution.
- **`winner: Bytes[32]`**: The public identifier/address commitment of the winning bidder.

---

## 4. Mainnet-Feasibility (Level 6 Production Scope)

Transitioning this protocol to Level 6 enterprise production on Midnight Mainnet encompasses the following milestones:

### 1. Shielded Escrow & Collateral Locking
In production, sealed bids must be backed by locked funds to prevent non-paying bidders from placing spurious high bids. Using Midnight's shielded token capabilities (`@midnight-ntwrk/wallet-sdk-shielded`), bidders will lock shielded tDUST/NIGHT tokens into a timelocked escrow contract upon calling `place_bid`.

### 2. Automated Slashing & Default Resolution
If the winning bidder fails to complete the settlement transaction within a designated challenge window (e.g., 24 hours), the protocol automatically slashes a percentage of their locked collateral and awards the lot to the second-highest bidder (Vickrey auction resolution).

### 3. Timelocked Epoch State Machine
Implementation of verifiable on-chain epoch transitions:
- **Phase 1: Bidding Epoch** (Blocks $N \to N+500$): Only `place_bid` permitted.
- **Phase 2: Reveal Epoch** (Blocks $N+501 \to N+750$): Only `reveal_bid` permitted.
- **Phase 3: Settlement Epoch** (Blocks $> N+750$): Winner claims asset; unrevealed/losing bidders claim escrow refunds.

### 4. Multi-Token Escrow & Decentralized Oracle Pricing
Integration of cross-chain liquidity and Midnight shielded asset registries to support multi-token bidding (e.g., ADA, shielded stablecoins, wrapped assets) with zero-knowledge price feeds for real-time reserve calculations.

---

## 📄 Summary Checklist
- [x] **Product and Users Defined:** Confidential procurement & high-value RWA sealed bidding.
- [x] **Midnight ZK Architecture Explained:** Eliminates MEV front-running and premature data leakage.
- [x] **Data Model Formatted:** Explicit breakdown of Witness, Circuit, Ledger, and `disclose()`.
- [x] **Mainnet Feasibility Outlined:** Shielded collateral locks, timelocked epochs, and automated dispute resolution.
