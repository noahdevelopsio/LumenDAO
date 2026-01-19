# LumenDAO Governance Framework

LumenDAO is a modular, decentralized governance system featuring Self-Sovereign Identity (SSI), Liquid Democracy, and Gasless Voting (EIP-712).

## 🚀 Key Features

*   **Self-Sovereign Identity**: Gated participation using Soulbound Tokens (SBTs) via `IdentityRegistry`.
*   **Liquid Democracy**: Users can delegate voting weight to others (Single-hop delegation).
*   **Gasless Voting**: EIP-712 signature verification allows for off-chain vote signing.
*   **Upgradeable Architecture**: Uses UUPS (Universal Upgradeable Proxy Standard) for all contracts.
*   **Privacy-Preserving**: Identity verification is separated from governance logic.

## 📂 Project Structure

*   `contracts/`: Solidity smart contracts (LumenDAO, IdentityRegistry).
*   `client/`: React + Vite + TypeScript frontend.
    *   `src/abi/`: Contract ABIs.
    *   `src/components/`: Shadcn/UI components.
*   `scripts/`: Deployment scripts.

## 🛠 Prerequisites

*   Node.js (v18+)
*   NPM
*   MetaMask (Browser Extension) using Localhost:8545

## 🏁 Getting Started

### 1. Start Local Blockchain
```bash
npx hardhat node
```

### 2. Deploy Contracts
In a new terminal:
```bash
npx hardhat run scripts/deploy.ts --network localhost
```
*   Copy the addresses for `IdentityRegistry` and `LumenDAO` from the output.

### 3. Configure Frontend
Create a `.env` file in the `client/` directory:

```env
VITE_LUMEN_DAO_ADDRESS=<your_lumen_dao_address>
VITE_IDENTITY_REGISTRY_ADDRESS=<your_identity_registry_address>
```

### 4. Run Frontend
```bash
cd client
npm install
npm run dev
```

## 🧪 Testing

Run smart contract tests:
```bash
npx hardhat test
```

## 📜 License
MIT
