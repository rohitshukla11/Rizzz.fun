# 🎬 Rizzz.fun

A mobile-first prediction market for short-form video content. Users predict which reels will win themed challenges and earn rewards for accurate predictions.

**Powered by Yellow Network for instant, gasless predictions.**

![Rizzz.fun Banner](./docs/banner.png)

## ✨ Features

- **📱 Mobile-First Design** - Beautiful, TikTok-style UI optimized for mobile
- **⚡ Instant Predictions** - Zero gas fees via Yellow Network state channels
- **🎯 Challenge-Based** - Themed video challenges with community voting
- **💰 Reward Distribution** - Automatic payouts to accurate predictors
- **🔐 Non-Custodial** - Your funds, your control

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Journey                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. DEPOSIT (On-chain)     2. PREDICT (Off-chain)    3. SETTLE │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────┐ │
│  │ User deposits    │ ──▶ │ Instant gasless  │ ──▶ │ On-chain │ │
│  │ tokens to open   │     │ predictions via  │     │ payout   │ │
│  │ Yellow session   │     │ Yellow Network   │     │          │ │
│  └──────────────────┘     └──────────────────┘     └──────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

- **Frontend**: Next.js 14, React 18, TailwindCSS, Framer Motion
- **State Channels**: Yellow Network SDK (@erc7824/nitrolite)
- **Smart Contracts**: Solidity 0.8.20, Hardhat
- **Web3**: wagmi, viem
- **State Management**: Zustand

## 🚀 Getting Started

### Quick Start (5 minutes)

See [QUICK_START.md](./QUICK_START.md) for a fast setup guide.

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or another Web3 wallet
- Sepolia testnet ETH (for testing)
- WalletConnect Project ID ([get one here](https://cloud.walletconnect.com/))

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/rizzz-fun.git
cd rizzz-fun

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

### Smart Contract Deployment

```bash
# Compile contracts
npm run contracts:compile

# Deploy to Sepolia testnet
npm run contracts:deploy

# Run tests
npm run contracts:test
```

## 📁 Project Structure

```
rizzz-fun/
├── contracts/           # Solidity smart contracts
│   ├── ReelPredict.sol  # Main prediction market contract
│   └── ReelToken.sol    # ERC20 token contract
├── src/
│   ├── app/             # Next.js app router pages
│   ├── components/      # React components
│   │   ├── challenge/   # Challenge-related components
│   │   ├── reel/        # Reel viewer & prediction UI
│   │   ├── wallet/      # Wallet connection & deposit
│   │   ├── layout/      # Navigation & layout
│   │   └── ui/          # Base UI components
│   ├── lib/
│   │   ├── yellow/      # Yellow Network SDK integration
│   │   └── utils.ts     # Utility functions
│   └── store/           # Zustand state management
├── public/              # Static assets & PWA manifest
└── scripts/             # Deployment scripts
```

## 🟡 Yellow Network Integration

Rizzz.fun uses Yellow Network to enable **instant, gasless predictions**. Here's how it works:

### 1. Session Opening (On-chain - Once)

```typescript
// User deposits tokens to open a Yellow session
const session = await yellowClient.openSession(depositAmount, challengeId);
```

### 2. Making Predictions (Off-chain - Instant)

```typescript
// All predictions happen off-chain through Yellow Network
await yellowClient.makePrediction(challengeId, reelId, amount);
// No gas fees! No waiting!
```

### 3. Settlement (On-chain - Once)

```typescript
// When challenge ends, settle all predictions
const proof = await yellowClient.requestSettlement(challengeId);
await contract.submitSettlement(challengeId, proof);
```

### Key Benefits

- **High Throughput**: 100,000+ TPS for predictions
- **Zero Gas**: All predictions are gasless
- **Instant**: No block confirmation wait times
- **Secure**: ERC-7824 compliant state channels

## 🎨 UI Components

### Challenge Card
Displays challenge info with live stats and countdown timer.

### Reel Viewer
TikTok-style vertical video player with prediction integration.

### Prediction Panel
Slide-up panel for making instant predictions.

### Deposit Modal
Multi-step flow for depositing tokens and opening Yellow session.

## 📱 PWA Support

Rizzz.fun is a Progressive Web App:

- **Installable**: Add to home screen
- **Offline Support**: Service worker caching
- **Fast**: Optimized for mobile performance

## 🔐 Smart Contract Security

- OpenZeppelin contracts for battle-tested security
- Reentrancy protection
- Multi-signature settlement verification
- Platform fee caps

## 🧪 Testing

### Quick Test
```bash
# Run setup check
./scripts/test-flow.sh

# Start dev server
npm run dev
```

### Complete Testing Guide
See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for:
- Complete user flow testing
- Step-by-step instructions
- Troubleshooting guide
- Test scenarios

## 🗺️ Roadmap

- [x] Core prediction mechanics
- [x] Yellow Network integration
- [x] Mobile-first UI
- [ ] Video upload & storage (IPFS)
- [ ] Social features (comments, shares)
- [ ] Multiple challenge types
- [ ] Governance token
- [ ] Cross-chain support

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md).

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🔗 Links

- [Yellow Network Docs](https://docs.yellow.org)
- [Demo Video](#)
- [Discord](#)
- [Twitter](#)

---

Built with 💜 for HackMoney 2026
