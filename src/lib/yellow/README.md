# Yellow Network Nitrolite Integration

This integration follows the official Yellow Network documentation: https://docs.yellow.org/docs/learn/

## Architecture Overview

Based on Yellow Network's core concepts:

### 1. **App Sessions** (Multi-party Application Channels)
- Each user creates an App Session when they deposit USDC
- Sessions are multi-party channels with custom application state
- State includes: balance, predictions, votes, and nonce

### 2. **Session Keys** (Delegated Keys for Gasless Interactions)
- Generated when a session is created
- Allows signing off-chain messages without wallet prompts
- Enables truly gasless predictions and voting

### 3. **Message Envelope** (RPC Protocol)
- All communication follows JSON-RPC 2.0 format
- Messages are signed and verified
- Supports request/response and push notifications

### 4. **Challenge-Response & Disputes**
- Users can challenge state if they detect inconsistencies
- Challenge-response mechanism ensures state integrity
- Disputes are resolved on-chain if needed

## Usage

### Initialize Client

```typescript
import { initializeNitroliteClient } from '@/lib/yellow';

const client = initializeNitroliteClient({
  environment: 'sandbox', // or 'production'
  appId: 'rizzz-fun',
  signer: walletClient,
});
```

### Create App Session

```typescript
// User deposits USDC to open a session
const session = await client.createAppSession(
  1000n * 10n ** 6n, // 1000 USDC (6 decimals)
  'challenge_001'
);
```

### Make Predictions (Gasless)

```typescript
// All predictions happen off-chain via Session Keys
// No gas fees, no wallet prompts!
const prediction = await client.makePrediction(
  'challenge_001',
  'reel_123',
  100n * 10n ** 6n // 100 USDC
);
```

### Vote (Gasless)

```typescript
// Voting also uses Session Keys
const vote = await client.vote('challenge_001', 'reel_123');
```

### Settlement

```typescript
// When challenge ends, request settlement
const settlement = await client.requestSettlement('challenge_001');

// Settlement data includes:
// - stateHash: Final state hash
// - signatures: Required signatures
// - finalState: Complete session state

// Submit to smart contract
await contract.submitSettlement(challengeId, settlement);
```

## React Hooks

### useYellowSession

Manages the current App Session:

```typescript
const { session, state, openSession, availableBalance } = useYellowSession();
```

### usePredictions

Manages predictions for a challenge:

```typescript
const { predictions, makePrediction, isLoading } = usePredictions('challenge_001');
```

### useVoting

Manages votes:

```typescript
const { votes, castVote } = useVoting();
```

### useSettlement

Handles settlement:

```typescript
const { settlementData, requestSettlement, isSettling } = useSettlement();
```

## Key Benefits

1. **Gasless Operations**: All predictions and votes use Session Keys
2. **Instant Finality**: Off-chain state updates are immediate
3. **Secure**: Challenge-response mechanism ensures state integrity
4. **Scalable**: Handles thousands of transactions per second
5. **Cost-Effective**: Only pay gas for deposit and settlement

## Flow Diagram

```
1. User deposits USDC (on-chain)
   ↓
2. App Session created (off-chain)
   ↓
3. Session Key generated (delegated signing)
   ↓
4. User makes predictions (off-chain, gasless)
   ↓
5. User votes (off-chain, gasless)
   ↓
6. Challenge ends
   ↓
7. Settlement requested (aggregates off-chain state)
   ↓
8. Settlement submitted to contract (on-chain, once)
```

## References

- [Yellow Network Documentation](https://docs.yellow.org/docs/learn/)
- [App Sessions](https://docs.yellow.org/docs/learn/core-concepts/app-sessions)
- [Session Keys](https://docs.yellow.org/docs/learn/core-concepts/session-keys)
- [Challenge-Response](https://docs.yellow.org/docs/learn/core-concepts/challenge-response)
- [ERC-7824 (Nitrolite)](https://erc7824.org/)
