/**
 * Solana connection and utility helpers
 * Uses mock data for demonstration - replace with real @solana/web3.js calls
 */

export interface WalletState {
  connected: boolean;
  address: string | null;
  balance: number; // SOL balance
}

export interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  decimals: number;
  logoUri?: string;
}

// Mock wallet store (replace with actual wallet adapter)
let walletState: WalletState = {
  connected: false,
  address: null,
  balance: 0,
};

export function getWalletState(): WalletState {
  return { ...walletState };
}

export function mockConnectWallet(): WalletState {
  walletState = {
    connected: true,
    address: "8xK9mBzLpQRnVwT3cY7dFhJeN2sAuXiCvMoP4gS5tEq",
    balance: 12.5482,
  };
  return getWalletState();
}

export function mockDisconnectWallet(): WalletState {
  walletState = {
    connected: false,
    address: null,
    balance: 0,
  };
  return getWalletState();
}

export function getMockTokenBalances(): TokenBalance[] {
  return [
    {
      mint: "So11111111111111111111111111111111111111112",
      symbol: "SOL",
      name: "Solana",
      balance: 12.5482,
      usdValue: 12.5482 * 168.45,
      decimals: 9,
    },
    {
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      symbol: "USDC",
      name: "USD Coin",
      balance: 2500.0,
      usdValue: 2500.0,
      decimals: 6,
    },
    {
      mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
      symbol: "USDT",
      name: "Tether USD",
      balance: 1200.0,
      usdValue: 1200.0,
      decimals: 6,
    },
    {
      mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
      symbol: "ETH",
      name: "Ethereum (Wormhole)",
      balance: 0.8234,
      usdValue: 0.8234 * 3242.11,
      decimals: 8,
    },
  ];
}

export function getSolPriceUsd(): number {
  return 168.45; // Mock price
}

export const LAMPORTS_PER_SOL = 1_000_000_000;

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}
