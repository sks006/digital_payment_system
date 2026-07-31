// post-eur.mjs — pushes a fresh EUR/USD PriceUpdateV2 to devnet.
//
// Run with: node post-eur.mjs
// Prints the EUR/USD account address — put that into pyth-feeds.ts

import {
  Connection,
  Keypair,
  VersionedTransaction,
} from "@solana/web3.js";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { Wallet } from "@coral-xyz/anchor";
import fs from "fs";
import os from "os";
import path from "path";

const EUR_USD_FEED_ID =
  "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b";

const SHARD_ID = 0;

(async () => {
  // Load Solana CLI default keypair (the one with your devnet SOL).
  const keypairFile = path.join(os.homedir(), ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairFile, "utf8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log("Posting from:", payer.publicKey.toBase58());

  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed",
  );

  // Check balance.
  const bal = await connection.getBalance(payer.publicKey);
  console.log("Balance:", bal / 1e9, "SOL");
  if (bal < 0.05 * 1e9) {
    console.error("Need at least 0.05 SOL for posting — airdrop more.");
    process.exit(1);
  }

  const receiver = new PythSolanaReceiver({
    connection,
    wallet: new Wallet(payer),
  });

  // Derive what the price feed account address WILL be.
  const eurUsdAccount = receiver.getPriceFeedAccountAddress(
    SHARD_ID,
    EUR_USD_FEED_ID,
  );
  console.log("Expected EUR/USD account:", eurUsdAccount.toBase58());

  // Fetch the latest EUR/USD price-update binary blob from Hermes.
  console.log("Fetching latest EUR/USD update from Hermes...");
  const url = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${EUR_USD_FEED_ID}&encoding=base64`;
  const res = await fetch(url);
  const json = await res.json();
  const priceUpdateData = json.binary.data;
  console.log("Got update blob, size:", priceUpdateData[0]?.length ?? "?");

  // Build the post-update tx (creates/refreshes the price feed account).
  const txBuilder = receiver.newTransactionBuilder({
    closeUpdateAccounts: false,
  });
  await txBuilder.addPostPriceUpdates(priceUpdateData);
  console.log("Building txs...");

  const txs = await txBuilder.buildVersionedTransactions({
    computeUnitPriceMicroLamports: 100000,
  });

  console.log(`Sending ${txs.length} tx(s)...`);
  for (const { tx, signers } of txs) {
    tx.sign([payer, ...signers]);
    const sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
    });
    console.log("  Sent:", sig);
    await connection.confirmTransaction(sig, "confirmed");
    console.log("  Confirmed");
  }

  // Verify the account now exists.
  const info = await connection.getAccountInfo(eurUsdAccount);
  console.log("\n========================================");
  if (info) {
    console.log("✅ SUCCESS — account exists, length:", info.data.length);
    console.log("EUR/USD account:", eurUsdAccount.toBase58());
    console.log("\n👉 Paste this into apps/web/src/lib/pyth-feeds.ts:");
    console.log(`   "${eurUsdAccount.toBase58()}"`);
  } else {
    console.log("❌ Account still doesn't exist — try again");
  }
  console.log("========================================");
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
