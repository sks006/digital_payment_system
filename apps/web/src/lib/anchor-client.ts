// apps/web/src/lib/anchor-client.ts
// Mock-free client for the Lending Vault Anchor program.
// Updated: fetchUserPosition now accepts a live SOL/USD price so the
// health factor and available credit shown in the UI match what the
// on-chain `borrow` instruction will enforce.

import {
  Program,
  AnchorProvider,
  BN,
} from "@coral-xyz/anchor";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import idl from "@/idl/lending_vault.json";

// ----------------------------------------------------------------------
// Type for our Anchor program (generated typings not available)
// ----------------------------------------------------------------------
export type LendingVault = any;

// ----------------------------------------------------------------------
// PDA seeds (must match the Rust program)
// ----------------------------------------------------------------------
const VAULT_SEED = Buffer.from("vault");
const VAULT_TOKEN_ACCOUNT_SEED = Buffer.from("vault_token_account");
const USER_POSITION_SEED = Buffer.from("user_position");
const EURC_MINT_SEED = Buffer.from("eurc_mint");

// ----------------------------------------------------------------------
// Program ID and token mints from environment
// ----------------------------------------------------------------------
export const LENDING_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_LENDING_PROGRAM_ID!,
);
export const EURC_MINT = getEurcMintPda();
export const WSOL_MINT = new PublicKey(process.env.NEXT_PUBLIC_WSOL_MINT!);



export function getEurcMintPda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [EURC_MINT_SEED],
    LENDING_PROGRAM_ID,
  )[0];
}
export function getVaultPda(): PublicKey {
  return PublicKey.findProgramAddressSync([VAULT_SEED], LENDING_PROGRAM_ID)[0];
}

export function getVaultTokenAccountPda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [VAULT_TOKEN_ACCOUNT_SEED],
    LENDING_PROGRAM_ID,
  )[0];
}

export function getUserPositionPda(userPubkey: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [USER_POSITION_SEED, userPubkey.toBuffer()],
    LENDING_PROGRAM_ID,
  )[0];
}

// ----------------------------------------------------------------------
// Program instance factory
// ----------------------------------------------------------------------
export function getLendingProgram(
  provider: AnchorProvider,
): Program<LendingVault> {
  return new (Program as any)(idl, provider);
}

// ----------------------------------------------------------------------
// Types (matching UI expectations)
// ----------------------------------------------------------------------
export interface CollateralPosition {
  owner: string;
  collateralMint: string;
  collateralSymbol: string;
  collateralAmount: number; // in SOL
  collateralUsdValue: number;
  borrowedAmount: number; // in EURC
  healthFactor: number;
  liquidationThreshold: number; // e.g. 1.2 = 120%
  ltv: number;
  maxBorrowable: number;
  /** SOL/USD price used for this calculation (so the UI can label it as "live") */
  solPriceUsd: number;
}

// ----------------------------------------------------------------------
// Real on-chain position fetch — uses LIVE Pyth price passed in from UI
// ----------------------------------------------------------------------
export async function fetchUserPosition(
  walletPubkey: PublicKey,
  provider: AnchorProvider,
  solPriceUsd: number,
  eurUsd: number,
): Promise<CollateralPosition | null> {
  if (!isFinite(solPriceUsd) || solPriceUsd <= 0) {
    throw new Error(
      "fetchUserPosition: solPriceUsd is required and must be > 0",
    );
  }

  const program = getLendingProgram(provider);
  const vaultPda = getVaultPda();
  const positionPda = getUserPositionPda(walletPubkey);

  try {
    const [vault, position] = await Promise.all([
      (program.account as any).vault.fetch(vaultPda),
      (program.account as any).userPosition.fetch(positionPda),
    ]);

    // Amounts are in native units: lamports (9 decimals) and EURC micro-units (6 decimals)
    const collateralAmount = position.depositedAmount.toNumber() / 1e9; // SOL
    const borrowedAmount = position.borrowedAmount.toNumber() / 1e6; // EURC
    const collateralUsd = collateralAmount * solPriceUsd;

    // Convert collateral USD → EUR to match the borrowed_amount unit
    const collateralEur =
      eurUsd && eurUsd > 0 ? collateralUsd / eurUsd : collateralUsd;

const healthFactor = borrowedAmount > 0
  ? (collateralEur * (vault.ltvThreshold / 100)) / borrowedAmount
  : 9999;

const maxBorrowable =
  (collateralEur * vault.ltvThreshold) / 100 - borrowedAmount;

    return {
      owner: position.owner.toString(),
      collateralMint: WSOL_MINT.toString(),
      collateralSymbol: "SOL",
      collateralAmount,
      collateralUsdValue: collateralUsd,
      borrowedAmount,
      healthFactor,
      liquidationThreshold: vault.liquidationThreshold / 100,
      ltv: vault.ltvThreshold / 100,
      maxBorrowable: maxBorrowable > 0 ? maxBorrowable : 0,
      solPriceUsd,
    };
  } catch (e) {
    // No position yet → return a zero-state position so the UI can render
    // a "Deposit to get started" view rather than a crash.
    console.warn("fetchUserPosition: no position yet, returning zero-state", e);
    return {
      owner: walletPubkey.toString(),
      collateralMint: WSOL_MINT.toString(),
      collateralSymbol: "SOL",
      collateralAmount: 0,
      collateralUsdValue: 0,
      borrowedAmount: 0,
      healthFactor: 9999,
      liquidationThreshold: 1.2,
      ltv: 0.8,
      maxBorrowable: 0,
      solPriceUsd,
    };
  }
}

// ----------------------------------------------------------------------
// Transaction builders
// ----------------------------------------------------------------------


// ----------------------------------------------------------------------
// Types for Real Data
// ----------------------------------------------------------------------

export interface AppTransaction {
  id: string;
  type: "purchase" | "topup" | "cashback" | "swap" | "interest";
  status: "completed" | "pending" | "failed";
  amount: number;
  description: string;
  timestamp: Date;
  merchant?: string;
  txHash?: string;
}

export interface CardState {
  cardNumber: string;
  cvv: string;
  expiryDate: string;
  isFrozen: boolean;
  mode: "credit" | "debit";
  spendingLimit: number;
  currentDaySpend: number;
  monthlySpend: number;
}

export async function buildBorrowTransaction(
  walletPubkey: PublicKey,
  amountEurc: number,
  provider: AnchorProvider,
  solPriceUpdate: PublicKey,
  eurPriceUpdate: PublicKey,
): Promise<Transaction> {
  const program = getLendingProgram(provider);
  const vaultPda = getVaultPda();
  const userPositionPda = getUserPositionPda(walletPubkey);

  const amountMicro = new BN(Math.round(amountEurc * 1e6));

  const tx = await (program.methods as any)
    .borrow(amountMicro)
    .accounts({
      user: walletPubkey,
      vault: vaultPda,
      userPosition: userPositionPda,
      solPriceUpdate,
      eurPriceUpdate,
      clock: SYSVAR_CLOCK_PUBKEY,
    } as any)
    .transaction();

  return tx;
}

export async function buildRepayTransaction(
  walletPubkey: PublicKey,
  amountEurc: number,
  provider: AnchorProvider,
): Promise<Transaction> {
  const eurcMint = getEurcMintPda();
  const program = getLendingProgram(provider);
  const vaultPda = getVaultPda();
  const vaultTokenAccount = getVaultTokenAccountPda();
  const userPositionPda = getUserPositionPda(walletPubkey);

  const userEurcAta = await getAssociatedTokenAddress(
    eurcMint,
    walletPubkey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const amountMicro = new BN(Math.round(amountEurc * 1e6));
  const tx = new Transaction();

  const accountInfo = await provider.connection.getAccountInfo(userEurcAta);
  if (!accountInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        walletPubkey,
        userEurcAta,
        walletPubkey,
        eurcMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  const ix = await (program.methods as any)
    .repay(amountMicro)
    .accounts({
      user: walletPubkey,
      userPosition: userPositionPda,
      vault: vaultPda,
      userTokenAccount: userEurcAta,
      vaultTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .instruction();

  tx.add(ix);
  return tx;
}