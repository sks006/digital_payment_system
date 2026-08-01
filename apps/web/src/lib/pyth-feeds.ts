// apps/web/src/lib/pyth-feeds.ts
import { PublicKey } from "@solana/web3.js";

/**
 * Pyth pull‑oracle price update accounts on Solana devnet.
 * These are required by borrow / liquidate instructions.
 */
export const SOL_USD_PRICE_UPDATE = new PublicKey(
  "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE"
);
export const EUR_USD_PRICE_UPDATE = new PublicKey(
  "Fu76ChamBDjE8UuGLV6GP2AcPPSU6gjhkNhAyuoPm7ny"
);