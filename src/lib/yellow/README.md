# Yellow Network Integration (@erc7824/nitrolite)

This module integrates the **real [@erc7824/nitrolite](https://www.npmjs.com/package/@erc7824/nitrolite) SDK** for state channel-based, gasless, instant predictions.

## Architecture

```
┌──────────────────────────────────────────────────┐
│              ON-CHAIN (only when needed)           │
│                                                   │
│  • deposit USDC → Yellow Custody contract         │
│  • createChannel → open state channel             │
│  • closeChannel + withdrawal → settle & exit      │
│  (Contract addresses fetched via get_config)      │
└──────────────────────────────────────────────────┘
                       │
┌──────────────────────────────────────────────────┐
│           OFF-CHAIN (unlimited, gasless)          │
│                                                   │
│  • WebSocket → Clearnode (NitroliteRPC)          │
│  • Auth (createAuthRequestMessage)               │
│  • get_config (discover contract addresses)      │
│  • App Sessions (createAppSessionMessage)        │
│  • Predictions & Votes (createApplicationMessage)│
│  • Close session (createCloseAppSessionMessage)  │
└──────────────────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `nitrolite-client.ts` | Core client wrapping `NitroliteClient` (on-chain) + `NitroliteRPC` (off-chain). Fetches config from Clearnode via `get_config`. |
| `hooks.ts` | React hooks: `useYellowConnection`, `useYellowSession`, `usePredictions`, `useVoting`, `useSettlement` |
| `settlement.ts` | Settlement service for challenge finalisation and payout distribution |
| `index.ts` | Re-exports |

## Env Vars

Only **one** env var is required for Yellow Network integration:

```bash
# The ONLY required variable
NEXT_PUBLIC_YELLOW_CLEARNODE_URL=wss://clearnet-sandbox.yellow.com/ws
```

Contract addresses (custody, adjudicator, guest, token) are **fetched automatically** from the Clearnode via `get_config` — no manual configuration needed.

For sandbox testing, test tokens come from the faucet API (no on-chain deposit required):
```
POST https://clearnet-sandbox.yellow.com/faucet/requestTokens
{"userAddress": "0x..."}
```

See: https://docs.yellow.org/docs/learn/getting-started/prerequisites

## Demo Mode vs Live Mode

| | Demo Mode | Live Mode |
|---|---|---|
| **When** | `NEXT_PUBLIC_YELLOW_CLEARNODE_URL` is empty | URL is set |
| **Config** | N/A | Contract addresses from `get_config` |
| **On-chain** | Simulated | Uses Yellow Custody contract |
| **Off-chain** | Local in-memory state tracking | WebSocket to Clearnode |
| **Sandbox tokens** | N/A | Faucet API (no on-chain deposit) |
| **For hackathon** | ✅ Full UX works | ✅ Production-ready |

## User Flow

### Sandbox (recommended for testing)
1. **Connect wallet** → MetaMask
2. **Start session** → faucet tokens credited instantly (no gas, no on-chain tx)
3. **Make predictions** → off-chain, instant, gasless
4. **Vote on reels** → off-chain, instant, gasless
5. **Settle** → on-chain when session ends

### Production
1. **Connect wallet** → MetaMask
2. **Deposit USDC** → on-chain to Yellow Custody (addresses from `get_config`)
3. **Open session** → creates Yellow App Session via WebSocket
4. **Make predictions** → off-chain, instant, gasless
5. **Settle** → on-chain (close session, distribute payouts)
