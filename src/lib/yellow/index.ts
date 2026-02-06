/**
 * Yellow Network @erc7824/nitrolite SDK Integration
 * Based on official Yellow Network documentation: https://docs.yellow.org/docs/learn/
 *
 * Implements:
 * - NitroliteClient (on-chain: deposit, createChannel, closeChannel, withdraw)
 * - NitroliteRPC    (off-chain: auth, app sessions, predictions, votes)
 * - App Sessions    (multi-party application channels)
 * - Session Keys    (delegated keys for gasless interactions)
 * - Settlement      (challenge settlement + payout distribution)
 */

// Core Yellow client (wraps real @erc7824/nitrolite SDK)
export * from './nitrolite-client';

// React hooks
export * from './hooks';

// Settlement service
export * from './settlement';
