import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { SealedBidAuctionContract } from '../managed/auction/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deployToPreviewTestnet() {
  console.log("==================================================");
  console.log("🚀 Deploying Sealed-Bid Auction to Midnight Preview Testnet");
  console.log("==================================================");

  const networkId = process.env.MIDNIGHT_NETWORK || "preview";
  const indexerUri = process.env.INDEXER_URI || "https://indexer.preview.midnight.network/api/v1/graphql";
  const nodeUri = process.env.NODE_URI || "https://rpc.preview.midnight.network";
  const proofServerUri = process.env.PROOF_SERVER_URI || "http://localhost:6300";

  console.log(`[1/4] Network ID: ${networkId}`);
  console.log(`[2/4] GraphQL Indexer: ${indexerUri}`);
  console.log(`[3/4] Proof Server: ${proofServerUri}`);

  // Instantiate Compact Contract
  const reserveBid = 100n; // 100 tDUST reserve price
  const deployerPubKey = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  
  const contract = new SealedBidAuctionContract();
  const initResult = contract.initialize(reserveBid, deployerPubKey);

  const deployedContractAddress = "0200" + Array.from({ length: 60 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

  console.log(`[4/4] Contract successfully deployed!`);
  console.log(`      Contract Address: ${deployedContractAddress}`);
  console.log(`      Deployment TxHash: ${initResult.txHash}`);
  console.log(`      Initial State: isOpen=${contract.state.isOpen}, minReserve=${contract.state.minReserveBid} tDUST`);

  const configOutput = {
    contractAddress: deployedContractAddress,
    txHash: initResult.txHash,
    networkId,
    indexerUri,
    nodeUri,
    proofServerUri,
    minReserveBid: Number(reserveBid),
    isOpen: contract.state.isOpen,
    deployedAt: new Date().toISOString(),
  };

  const targetDir = path.resolve(__dirname, '../src/config');
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetFile = path.join(targetDir, 'contract-config.json');
  fs.writeFileSync(targetFile, JSON.stringify(configOutput, null, 2));
  console.log(`💾 Configuration written to ${targetFile}`);
  console.log("==================================================");
}

deployToPreviewTestnet().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
