/**
 * Yellow Network Nitrolite SDK Integration
 * Based on official Yellow Network documentation: https://docs.yellow.org/docs/learn/
 * 
 * Implements:
 * - App Sessions (multi-party application channels)
 * - Session Keys (delegated keys for gasless interactions)
 * - Message Envelope (RPC Protocol)
 * - Challenge-Response & Disputes
 */

// Export new Nitrolite client (aligned with official Yellow Network patterns)
export * from './nitrolite-client';

// Export hooks (updated to use Nitrolite client)
export * from './hooks';

// Legacy client exports (deprecated - use nitrolite-client instead)
export * from './client';
