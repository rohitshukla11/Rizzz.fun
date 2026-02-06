# Yellow Network Integration (@erc7824/nitrolite)

This module integrates the **real [@erc7824/nitrolite](https://www.npmjs.com/package/@erc7824/nitrolite) SDK** for state channel-based, gasless, instant predictions.

## Architecture

```
┌──────────────────────────────────────────────────┐
│              ON-CHAIN (2 transactions total)      │
│                                                   │
│  1. approve USDC → Custody contract              │
│  2. deposit     → lock funds in state channel    │
│  …                                               │
│  N. closeChannel + withdrawal → settle & exit    │
└──────────────────────────────────────────────────┘
                       │
┌──────────────────────────────────────────────────┐
│           OFF-CHAIN (unlimited, gasless)          │
│                                                   │
│  • WebSocket → Clearnode (NitroliteRPC)          │
│  • Auth (createAuthRequestMessage)               │
│  • App Sessions (createAppSessionMessage)        │
│  • Predictions & Votes (createApplicationMessage)│
│  • Close session (createCloseAppSessionMessage)  │
└──────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `nitrolite-client.ts` | Core client wrapping `NitroliteClient` (on-chain) + `NitroliteRPC` (off-chain) |
| `hooks.ts` | React hooks: `useYellowConnection`, `useYellowSession`, `usePredictions`, `useVoting`, `useSettlement` |
| `settlement.ts` | Settlement service for challenge finalisation and payout distribution |
| `index.ts` | Re-exports |

## SDK Usage

The client uses the actual `@erc7824/nitrolite` SDK:

```typescript
// On-chain operations (NitroliteClient from SDK)
import { NitroliteClient } from '@erc7824/nitrolite';
client.deposit(amount)
client.createChannel({ initialAllocationAmounts: [userAmt, guestAmt] })
client.closeChannel({ finalState })
client.withdrawal(amount)

// Off-chain operations (NitroliteRPC from SDK)
import { createAuthRequestMessage, createAppSessionMessage, createApplicationMessage } from '@erc7824/nitrolite';
createAuthRequestMessage(signer, address)       // Auth to clearnode
createAppSessionMessage(signer, sessionParams)   // Open app session
createApplicationMessage(signer, sessionId, data) // Send prediction/vote
createCloseAppSessionMessage(signer, closeReq)   // Close session
```

## Demo Mode vs Live Mode

| | Demo Mode | Live Mode |
|---|---|---|
| **When** | `NEXT_PUBLIC_YELLOW_CLEARNODE_URL` is empty | All Yellow env vars are set |
| **On-chain** | Uses our ReelPredict contract | Uses Yellow Custody + Adjudicator |
| **Off-chain** | Local in-memory state tracking | WebSocket to Clearnode |
| **Session** | Simulated locally | Real NitroliteRPC session |
| **For hackathon** | ✅ Full UX works end-to-end | ✅ Production-ready |

## Env Vars

```bash
# Required for LIVE mode
NEXT_PUBLIC_YELLOW_CLEARNODE_URL=wss://clearnet-sandbox.yellow.com/ws
NEXT_PUBLIC_YELLOW_CUSTODY_ADDRESS=0x...
NEXT_PUBLIC_YELLOW_ADJUDICATOR_ADDRESS=0x...
NEXT_PUBLIC_YELLOW_GUEST_ADDRESS=0x...

# Always set
NEXT_PUBLIC_YELLOW_APP_ID=rizzz-fun
NEXT_PUBLIC_USDC_TOKEN_ADDRESS=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
```

## User Flow

1. **Connect wallet** → MetaMask
2. **Deposit USDC** → on-chain (approve + deposit to ReelPredict contract)
3. **Open session** → off-chain (creates Yellow App Session)
4. **Make predictions** → off-chain, instant, gasless (via `createApplicationMessage`)
5. **Vote on reels** → off-chain, instant, gasless
6. **Settle** → on-chain (close session, distribute payouts)
