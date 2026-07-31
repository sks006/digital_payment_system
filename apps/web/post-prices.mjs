// post-prices.mjs — pushes fresh SOL/USD and EUR/USD PriceUpdateV2 to devnet.
//
// Run with: npx tsx post-prices.mjs

import {
  Connection,
  Keypair,
} from "@solana/web3.js";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { Wallet } from "@coral-xyz/anchor";
import fs from "fs";
import os from "os";
import path from "path";

const SOL_USD_FEED_ID = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const EUR_USD_FEED_ID = "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b";

const SHARD_ID = 0;

(async () => {
  const keypairFile = path.join(os.homedir(), ".config/solana/id.json");
  const keypairData = JSON.parse(fs.readFileSync(keypairFile, "utf8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log("Posting from:", payer.publicKey.toBase58());

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const receiver = new PythSolanaReceiver({ connection, wallet: new Wallet(payer) });

  const feeds = [
    { name: "SOL/USD", id: SOL_USD_FEED_ID },
    { name: "EUR/USD", id: EUR_USD_FEED_ID },
  ];

  for (const feed of feeds) {
    console.log(`\n--- Refreshing ${feed.name} ---`);
    const account = receiver.getPriceFeedAccountAddress(SHARD_ID, feed.id);
    console.log(`Target account: ${account.toBase58()}`);

    const url = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feed.id}&encoding=base64`;
    const res = await fetch(url);
    const json = await res.json();
    const priceUpdateData = json.binary.data;

    const txBuilder = receiver.newTransactionBuilder({ closeUpdateAccounts: false });
    await txBuilder.addPostPriceUpdates(priceUpdateData);

    const txs = await txBuilder.buildVersionedTransactions({ computeUnitPriceMicroLamports: 100000 });
    console.log(`Sending ${txs.length} tx(s) for ${feed.name}...`);

    for (const { tx, signers } of txs) {
      tx.sign([payer, ...signers]);
      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction(sig, "confirmed");
      console.log(` Confirmed: ${sig}`);
    }
    
    console.log(`✅ ${feed.name} updated!`);
  }

  console.log("\nUpdate complete. Update your src/lib/pyth-feeds.ts with these if they changed:");
  for (const feed of feeds) {
    const account = receiver.getPriceFeedAccountAddress(SHARD_ID, feed.id);
    console.log(`${feed.name}: ${account.toBase58()}`);
  }
})().catch(console.error);
