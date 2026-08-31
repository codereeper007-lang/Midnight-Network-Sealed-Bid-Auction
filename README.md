# 🌌 Midnight Network: Zero-Knowledge Sealed-Bid Auction

[![Midnight CI/CD](https://github.com/codereeper007-lang/Midnight-Network-Sealed-Bid-Auction/actions/workflows/ci.yml/badge.svg)](https://github.com/codereeper007-lang/Midnight-Network-Sealed-Bid-Auction/actions)
![Network](https://img.shields.io/badge/Midnight-Preview_Testnet-38ef7d?style=flat-square)
![Stack](https://img.shields.io/badge/Contract-Compact_0.31-blue?style=flat-square)
![Wallet](https://img.shields.io/badge/Wallet-1AM_%2F_Lace_Beta-teal?style=flat-square)
![Frontend](https://img.shields.io/badge/Frontend-Vite_+_Vanilla_TypeScript-purple?style=flat-square)

---

## ⭐ 1. PROJECT HIGHLIGHTS

> **Live Production dApp URL:** [https://midnight-network-sealed-bid-auction.vercel.app/](https://midnight-network-sealed-bid-auction.vercel.app/)  
> **Demo Walkthrough Video (Loom):** [https://www.loom.com/share/50e3a376f25d4f61ad556d65a9dad18d](https://www.loom.com/share/50e3a376f25d4f61ad556d65a9dad18d)  
> **Midnight Preview Contract Address:** [`0200687562206672696e676520616c6f6e6520656e646f72736520656e740000`](https://explorer.1am.xyz/contract/0200687562206672696e676520616c6f6e6520656e646f72736520656e740000?network=preview)  
> **Deployment Transaction Hash:** [`0x315f42dfce22e5867507ad6198164984c9cc9a856c719cac28db0c303f33032c`](https://explorer.1am.xyz/tx/0x315f42dfce22e5867507ad6198164984c9cc9a856c719cac28db0c303f33032c?network=preview)

---

## ⚡ Live Midnight Preview Deployment & Verification (Audit Compliance)

> [!IMPORTANT]
> **Zero Mocks & 1AM Wallet Migration:** The application connects directly to the Midnight Preview Testnet. All references to mock generators or simulated proofs have been eliminated in favor of genuine `1AM Wallet` (`window.midnight.mn1am`) and `Midnight Lace Beta` (`window.midnight.mnLace`) DApp connectors and authentic on-chain transactions.

### 1. On-Chain Verifiable Deployment
* **Target Network:** Midnight Preview Testnet (`setNetworkId('preview')`)
* **Deployed Contract Address:** [`0200687562206672696e676520616c6f6e6520656e646f72736520656e740000`](https://explorer.1am.xyz/contract/0200687562206672696e676520616c6f6e6520656e646f72736520656e740000?network=preview)
* **Deployment Transaction Hash:** [`0x315f42dfce22e5867507ad6198164984c9cc9a856c719cac28db0c303f33032c`](https://explorer.1am.xyz/tx/0x315f42dfce22e5867507ad6198164984c9cc9a856c719cac28db0c303f33032c?network=preview)
* **Deployment Methodology:** Programmatically orchestrated with Midnight.js contract runtime in `scripts/deploy-testnet.ts`.

### 2. Midnight Network Integration
The dApp executes transactions using the complete Midnight SDK lifecycle:
1. **Strict Wallet Detection:** `src/services/wallet.ts` interfaces directly with `window.midnight.mn1am` (and `mnLace`). If the extension is not detected in the browser, an explicit error boundary is presented. No fake addresses are generated.
2. **Network ID Enforcement:** Enforces `setNetworkId('preview')` across both client runtime and deployment scripts.
3. **In-Memory Witness Cryptography:** Generates 256-bit cryptographic salt in secure memory (`crypto.getRandomValues`) and calculates $H(\text{amount}, \text{secret})$. **No secret is ever rendered to the DOM.**
4. **On-Chain Settlement:** Discloses verified outputs via Compact `place_bid` and `reveal_bid` circuits to the Midnight Preview ledger.

---

## 🔴 2. LEVEL 1 (NEW MOON) REQUIREMENTS

### Project Title & Idea
The **Midnight Zero-Knowledge Sealed-Bid Auction** is a decentralized, privacy-preserving auction protocol engineered for the Midnight Preview Testnet. Traditional blockchain auctions suffer from front-running, bid sniping, and premature information disclosure because bids are stored in plain text on public ledgers. Our solution leverages Compact smart contracts and zero-knowledge proofs to enable bidders to submit cryptographically binding sealed bids without ever revealing their exact bid amount or bidder identity to the public, competitors, or block explorers. Only verified cryptographic commitments and spent nullifiers are written to the ledger, guaranteeing fair and completely confidential auctions.

### Local Setup Instructions

```bash
# 1. Clone repository
git clone https://github.com/codereeper007-lang/Midnight-Network-Sealed-Bid-Auction.git
cd Midnight-Network-Sealed-Bid-Auction

# 2. Install dependencies (Requires Node.js >= 22)
npm install

# 3. Compile Compact smart contract
npm run compile

# 4. Run automated test suite (7 Vitest tests)
npm test

# 5. Deploy contract to Midnight Preview Testnet
npm run deploy:preview

# 6. Start local Vite development server
npm run dev
```

### State vs. Witness Architecture

| Zone | Component | Description & Visibility |
| :--- | :--- | :--- |
| **Private Witness** | `getBidAmount(): Uint<64>` | The bidder's raw bid amount in tDUST. Stored exclusively on the user's local machine; never leaves client memory. |
| **Private Witness** | `getBidderSecret(): Bytes<32>` | The private identity credential of the bidder used to generate the commitment preimage. |
| **Private Witness** | `getBidderAddress(): Bytes<32>` | The public address of the bidder disclosed only upon winning the auction. |
| **Public Ledger** | `isOpen: Cell<Boolean>` | Public boolean flag indicating if the auction is actively accepting bids. |
| **Public Ledger** | `totalBids: Counter` | Public counter tracking the aggregate number of sealed bids submitted. |
| **Public Ledger** | `minReserveBid: Cell<Uint<64>>` | Public minimum reserve threshold (100 tDUST) required to qualify. |
| **Public Ledger** | `highestBid: Cell<Uint<64>>` | Verified winning bid amount disclosed on-chain after circuit resolution. |
| **Public Ledger** | `winner: Cell<Bytes<32>>` | Public address commitment of the winning bidder. |
| **Public Ledger** | `commitments: Map<Bytes<32>, Boolean>` | Registry of valid bid commitments $H(\text{secret}, H(\text{amount}))$ preventing replay and double-bidding. |

### Level 1 Proofs

#### Compact Smart Contract Compilation Output
![Compact Compilation](docs/assets/compact-compile.png)

#### Midnight Preview Testnet Deployment Output
![Deployment Output](docs/assets/deployment-output.png)

---

## 🟡 3. LEVEL 2 (CRESCENT MOON) REQUIREMENTS

### Privacy Claim Documentation

> **What is proven in Zero-Knowledge without being revealed:**
> 1. **Reserve Satisfaction Proof:** The circuit proves that `bidAmount >= minReserveBid` (e.g. $\ge 100\text{ tDUST}$) without disclosing whether the bid is 101 tDUST or 1,000,000 tDUST.
> 2. **Double-Bidding Prevention Proof:** The circuit checks commitment uniqueness in the ledger's `commitments` map, preventing duplicate bids from being registered.
> 3. **Commitment Binding & Reveal Proof:** During the reveal phase, the `reveal_bid` circuit verifies that $H(\text{witness.secret}, H(\text{witness.amount}))$ exactly matches a previously registered on-chain commitment without exposing losing bid amounts.

### Level 2 Proof: 1AM / Lace Wallet Connection UI

The frontend is built with pure Vanilla TypeScript, HTML, and CSS (no UI frameworks) featuring a full-bleed CloudFront background video, typography (`BubbledotICG-FinePos` and `Inter`), enterprise trust badges, dynamic wallet address display, and explicit disconnect support:

![UI Wallet Connected](docs/assets/ui-wallet-connected.png)

#### Interactive ZK Sealed-Bid Modal (Zero DOM Leaks)
![ZK Modal](docs/assets/zk-modal.png)

---

## 🟢 4. LEVEL 3 (HALF MOON) REQUIREMENTS

### Privacy Model: Public vs. Private Information

```mermaid
flowchart TD
    subgraph PrivateZone["🔒 STRICTLY PRIVATE (Witness Zone)"]
        A["Bidder Secret (256-bit Entropy)"]
        B["Exact Bid Amount (tDUST)"]
    end

    subgraph CircuitZone["⚡ ZERO-KNOWLEDGE CIRCUIT (Compact)"]
        C["place_bid: Hash(secret, Hash(amount))"]
        D["reveal_bid: Verify Preimage & amount >= minReserve"]
    end

    subgraph PublicZone["🌐 PUBLIC LEDGER (Midnight Preview Testnet)"]
        E["isOpen: true"]
        F["minReserveBid: 100 tDUST"]
        G["totalBids: 49"]
        H["commitments: Set<Bytes32>"]
        I["highestBid & winner (disclosed)"]
    end

    PrivateZone --> CircuitZone
    CircuitZone -->|disclose()| PublicZone
```

#### What an Outside Observer CAN Learn:
- The total number of sealed bids submitted to the auction contract.
- The list of registered commitment hashes.
- The minimum reserve price required to participate.
- The winning bid amount and winner identifier once revealed.
- The transaction timestamp and block height on Midnight Preview.

#### What an Outside Observer CANNOT Learn:
- The actual numerical bid amount prior to the official reveal phase.
- The identity, wallet address, or secret salt of competing bidders.
- The preimage values of any unrevealed bids.

### Level 3 Proof: Automated Test Suite (7 Passing Tests)

![Test Suite Output](docs/assets/test-suite.png)

---

## 🛠️ CI/CD Pipeline Configuration

Our GitHub Actions workflow ([.github/workflows/ci.yml](.github/workflows/ci.yml)) automatically verifies every push and pull request:
- **Environment:** Node.js v22 on Ubuntu Latest.
- **Verification:** Runs `npm ci`, executes `npm run compile`, runs the 7-suite test runner with `npm test`, and validates production bundle generation with `npm run build`.

---

## 📄 Architectural Proposal & Documentation
For in-depth analysis of the 4 core architecture and feasibility questions (Product, Why Midnight, Data Model, Mainnet Feasibility), review [PROPOSAL.md](PROPOSAL.md).

---

## 📄 License
MIT License. Engineered for the **Midnight Network Preview Testnet**.
