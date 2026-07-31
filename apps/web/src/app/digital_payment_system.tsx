/**
 * Digital Payment System — Root application entry
 *
 * This file serves as the application manifest/root config.
 * The actual UI entry point is src/app/page.tsx (landing page).
 *
 * Architecture:
 * - Landing:       /              → src/app/page.tsx
 * - Dashboard:     /dashboard     → src/app/dashboard/page.tsx
 * - Card Mgmt:     /card          → src/app/card/page.tsx
 * - Swap:          /swap          → src/app/swap/page.tsx
 * - POS Simulator: /pos-simulator → src/app/pos-simulator/page.tsx
 */

export const APP_NAME = "Digital Payment System";
export const APP_VERSION = "0.1.0";
export const APP_DESCRIPTION = "Crypto card powered by Solana & Jupiter DEX";

export const ROUTES = {
  HOME: "/",
  DASHBOARD: "/dashboard",
  CARD: "/card",
  SWAP: "/swap",
  POS_SIMULATOR: "/pos-simulator",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
