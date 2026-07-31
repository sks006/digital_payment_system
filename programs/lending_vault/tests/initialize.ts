import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { LendingVault } from "../../../target/types/lending_vault";

const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

describe("lending_vault - Initialize", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.LendingVault as Program<LendingVault>;

  it("Initializes the lending vault with EURC mint", async () => {
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId,
    );
    const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault_token_account")],
      program.programId,
    );
    const [eurcMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("eurc_mint")],
      program.programId,
    );

    console.log("📍 Program ID:    ", program.programId.toBase58());
    console.log("📍 Vault PDA:     ", vaultPda.toBase58());
    console.log("📍 Vault wSOL ATA:", vaultTokenAccount.toBase58());
    console.log("📍 EURC Mint PDA: ", eurcMint.toBase58());

    const existing = await provider.connection.getAccountInfo(vaultPda);
    if (existing) {
      console.log("⚠️  Already initialized. Skipping.");
      return;
    }

    const tx = await program.methods
      .initialize()
      .accounts({
        authority: provider.wallet.publicKey,
        vault: vaultPda,
        vaultTokenAccount,
        wsolMint: WSOL_MINT,
        eurcMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      } as any)
      .rpc();

    console.log("✅ Initialized! Tx:", tx);
    console.log("\n🔥 SAVE THIS EURC MINT ADDRESS:", eurcMint.toBase58());
  });
});