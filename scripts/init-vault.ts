// scripts/init-vault.ts
//
// One-time vault initialization for the upgraded lending_vault program.
// Run this AFTER `anchor deploy` against devnet.
//
//   npx tsx scripts/init-vault.ts
//
// The script creates:
//   1. The Vault PDA (seed: "vault")
//   2. The wSOL collateral token account (seed: "vault_token_account")
//   3. The EURC-like mint with vault as authority (seed: "eurc_mint")
//
// On success, it prints:
//   - The program ID (paste into NEXT_PUBLIC_LENDING_PROGRAM_ID)
//   - The EURC mint address (paste into NEXT_PUBLIC_EURC_MINT)
//   - The Solana Explorer link to verify everything

import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Load the IDL — adjust path to wherever your built IDL lives
import idl from "../target/idl/lending_vault.json";

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const WSOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112",
);

// Read the program ID from the IDL (set by `anchor keys sync`)
const PROGRAM_ID = new PublicKey((idl as any).address);

async function main() {
  console.log("──────────────────────────────────────");
  console.log("  Digital Payment System Vault Initializer");
  console.log("──────────────────────────────────────");
  console.log("RPC:        ", RPC_URL);
  console.log("Program ID: ", PROGRAM_ID.toBase58());
  console.log();

  // Load the wallet that will pay rent and become the vault authority
  const walletPath = path.join(os.homedir(), ".config/solana/id.json");
  const secret = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const authority = Keypair.fromSecretKey(Uint8Array.from(secret));

  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new AnchorProvider(
    connection,
    new Wallet(authority),
    { commitment: "confirmed" },
  );

  // Patch IDL for Anchor 0.30+ compatibility if missing type fields in accounts
  if (idl.accounts) {
    idl.accounts.forEach((acc: any) => {
      if (!acc.type) acc.type = acc.name;
    });
  }

  const program = new Program(idl as any, provider);

  // Derive the three PDAs
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    PROGRAM_ID,
  );
  const [vaultTokenAccountPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_token_account")],
    PROGRAM_ID,
  );
  const [eurcMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("eurc_mint")],
    PROGRAM_ID,
  );

  console.log("Vault PDA:           ", vaultPda.toBase58());
  console.log("Vault token account: ", vaultTokenAccountPda.toBase58());
  console.log("EURC mint:           ", eurcMintPda.toBase58());
  console.log();

  // Check if vault already exists
  const existing = await connection.getAccountInfo(vaultPda);
  if (existing !== null) {
    console.log("⚠️  Vault is already initialized.");
    console.log("    If you upgraded the program and need a fresh vault,");
    console.log("    deploy with a new program ID (`solana-keygen new ...`)");
    console.log("    and re-run this script.");
    return;
  }

  console.log("Sending initialize transaction...");

  const sig = await program.methods
    .initialize()
    .accounts({
      authority: authority.publicKey,
      vault: vaultPda,
      vaultTokenAccount: vaultTokenAccountPda,
      wsolMint: WSOL_MINT,
      eurcMint: eurcMintPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([authority])
    .rpc({ commitment: "confirmed" });

  console.log("✅ Vault initialized.");
  console.log();
  console.log("Transaction:", sig);
  console.log(
    `Explorer:    https://explorer.solana.com/tx/${sig}?cluster=devnet`,
  );
  console.log();
  console.log("──────────────────────────────────────");
  console.log("  Update your frontend .env.local:");
  console.log("──────────────────────────────────────");
  console.log(`NEXT_PUBLIC_LENDING_PROGRAM_ID=${PROGRAM_ID.toBase58()}`);
  console.log(`NEXT_PUBLIC_EURC_MINT=${eurcMintPda.toBase58()}`);
  console.log(`NEXT_PUBLIC_WSOL_MINT=${WSOL_MINT.toBase58()}`);
  console.log();
}

main().catch((e) => {
  console.error("❌ Initialize failed:", e);
  process.exit(1);
});