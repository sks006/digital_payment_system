/**
 * Jupiter DEX aggregator integration
 * Provides swap quotes and execution helpers
 * Uses mock data for UI demonstration
 */

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: number;
  outAmount: number;
  otherAmountThreshold: number;
  swapMode: "ExactIn" | "ExactOut";
  slippageBps: number;
  platformFee: number | null;
  priceImpactPct: number;
  routePlan: RoutePlan[];
  contextSlot: number;
  timeTaken: number;
}

export interface RoutePlan {
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: number;
    outAmount: number;
    feeAmount: number;
    feeMint: string;
  };
  percent: number;
}

export interface TokenInfo {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI?: string;
  tags?: string[];
}

// Common token mints on Solana
export const TOKENS: Record<string, TokenInfo> = {
  SOL: {
    address: "So11111111111111111111111111111111111111112",
    chainId: 101,
    decimals: 9,
    name: "Solana",
    symbol: "SOL",
  },
  USDC: {
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    chainId: 101,
    decimals: 6,
    name: "USD Coin",
    symbol: "USDC",
  },
  USDT: {
    address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    chainId: 101,
    decimals: 6,
    name: "Tether USD",
    symbol: "USDT",
  },
  ETH: {
    address: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
    chainId: 101,
    decimals: 8,
    name: "Ethereum (Wormhole)",
    symbol: "ETH",
  },
  BTC: {
    address: "9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E",
    chainId: 101,
    decimals: 6,
    name: "Bitcoin (Wormhole)",
    symbol: "BTC",
  },
};

// Mock exchange rates (token -> USD)
const MOCK_RATES: Record<string, number> = {
  SOL: 168.45,
  USDC: 1.0,
  USDT: 1.0,
  ETH: 3242.11,
  BTC: 68420.0,
};

export function getMockQuote(
  inputSymbol: string,
  outputSymbol: string,
  inAmount: number
): SwapQuote {
  const inputRate = MOCK_RATES[inputSymbol] || 1;
  const outputRate = MOCK_RATES[outputSymbol] || 1;
  const usdValue = inAmount * inputRate;
  const outAmount = usdValue / outputRate;
  const priceImpact = inAmount > 100 ? 0.12 : 0.05;

  return {
    inputMint: TOKENS[inputSymbol]?.address || "",
    outputMint: TOKENS[outputSymbol]?.address || "",
    inAmount: inAmount,
    outAmount: outAmount * (1 - priceImpact / 100),
    otherAmountThreshold: outAmount * 0.995,
    swapMode: "ExactIn",
    slippageBps: 50,
    platformFee: null,
    priceImpactPct: priceImpact,
    routePlan: [
      {
        swapInfo: {
          ammKey: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
          label: "Serum",
          inputMint: TOKENS[inputSymbol]?.address || "",
          outputMint: TOKENS[outputSymbol]?.address || "",
          inAmount: inAmount,
          outAmount: outAmount,
          feeAmount: inAmount * 0.003,
          feeMint: TOKENS[inputSymbol]?.address || "",
        },
        percent: 100,
      },
    ],
    contextSlot: 245678901,
    timeTaken: 0.312,
  };
}

export function getTokenList(): TokenInfo[] {
  return Object.values(TOKENS);
}
