"use client";

// =============================================================================
// PHANTOM MOBILE DEEP-LINK SERVICE
// =============================================================================
//
// This file handles the cryptographic handshake and message format used to
// talk to Phantom mobile via deep links. The flow:
//
//   1. CONNECT  — your dapp generates a keypair, sends its public key to
//                 Phantom along with a redirect URL. Phantom returns its
//                 public key + a session token, encrypted under a shared
//                 secret derived via Diffie-Hellman.
//
//   2. SIGN     — your dapp builds a transaction, encrypts it with the
//                 shared secret, opens a deep link to Phantom. Phantom
//                 signs the tx and returns it (still encrypted) via the
//                 redirect URL. YOUR DAPP THEN BROADCASTS to Solana.
//
// Key insight: we use signTransaction (NOT signAndSendTransaction).
// Reasons:
//   - signAndSendTransaction is deprecated by Phantom.
//   - signAndSendTransaction silently fails on devnet — only works on mainnet.
//   - signTransaction works on all clusters and gives us broadcast control.
//
// Dependencies:
//   - tweetnacl: NaCl box (Curve25519) for asymmetric encryption.
//   - bs58: base58 encoding for keys, nonces, and serialized data (Solana convention).
//
// =============================================================================

import nacl from "tweetnacl";
import bs58 from "bs58";
import { PublicKey, Transaction, VersionedTransaction, Connection } from "@solana/web3.js";

// -----------------------------------------------------------------------------
// localStorage keys.
// We keep four pieces of state across page reloads so the user stays "logged in"
// to Phantom between visits.
// -----------------------------------------------------------------------------
const DAPP_KEYPAIR = "phantom:dapp_keypair";   // our encryption keypair (public + secret)
const SESSION = "phantom:session";              // session token from Phantom
const PHANTOM_PUBKEY = "phantom:phantom_pubkey"; // Phantom's encryption public key
const USER_PUBKEY = "phantom:user_pubkey";      // user's Solana wallet address

// Type for our locally-stored encryption keypair.
// publicKey + secretKey are both base58-encoded strings.
interface DappKeypair {
  publicKey: string; // bs58
  secretKey: string; // bs58
}

// =============================================================================
// SECTION 1 — Keypair management
// =============================================================================
//
// On first visit we generate a fresh NaCl box keypair and persist it.
// This keypair is the dapp's encryption identity — Phantom uses it to
// derive a shared secret for end-to-end encryption.
// =============================================================================

/**
 * Returns the dapp's encryption keypair, creating one if it doesn't exist yet.
 *
 * The keypair is persisted in localStorage so it survives page reloads.
 * Each device gets its own keypair (which is fine — the user reconnects via
 * Phantom anyway, which establishes a new session).
 */
export function getOrCreateDappKeypair(): DappKeypair {
  // Try to load an existing keypair first.
  const stored = localStorage.getItem(DAPP_KEYPAIR);
  if (stored) return JSON.parse(stored);

  // No keypair found — generate a fresh one. nacl.box.keyPair() returns
  // raw Uint8Arrays, which we convert to base58 strings for JSON storage.
  const kp = nacl.box.keyPair();
  const pair: DappKeypair = {
    publicKey: bs58.encode(kp.publicKey),
    secretKey: bs58.encode(kp.secretKey),
  };
  localStorage.setItem(DAPP_KEYPAIR, JSON.stringify(pair));
  return pair;
}

/**
 * Reads all four pieces of session state from localStorage.
 *
 * Returns null fields if anything is missing — the caller should treat
 * that as "user is not connected".
 */
export function getStoredSession() {
  // SSR safety: localStorage doesn't exist on the server.
  if (typeof window === "undefined") {
    return { session: null, phantomPubkey: null, userPubkey: null };
  }
  const session = localStorage.getItem(SESSION);
  const phantomPubkey = localStorage.getItem(PHANTOM_PUBKEY);
  const userPubkeyStr = localStorage.getItem(USER_PUBKEY);
  return {
    session,
    phantomPubkey,
    // Convert string back to PublicKey for Solana operations.
    userPubkey: userPubkeyStr ? new PublicKey(userPubkeyStr) : null,
  };
}

/**
 * Wipes the session — used by disconnect().
 * Note: we keep the dapp keypair so reconnecting later doesn't require
 * generating a new identity.
 */
export function clearSession() {
  localStorage.removeItem(SESSION);
  localStorage.removeItem(PHANTOM_PUBKEY);
  localStorage.removeItem(USER_PUBKEY);
}

// =============================================================================
// SECTION 2 — Encryption helpers (NaCl box / Diffie-Hellman)
// =============================================================================
//
// Phantom uses NaCl box for end-to-end encryption. Both sides have keypairs.
// Given Phantom's public key + our secret key, we can derive a shared secret
// that only the two of us can compute. Everything between dapp and Phantom
// is encrypted under that shared secret.
// =============================================================================

/**
 * Computes the shared secret for symmetric encryption.
 * nacl.box.before() implements the Diffie-Hellman key exchange.
 */
function getSharedSecret(phantomPubkeyB58: string): Uint8Array {
  const dapp = getOrCreateDappKeypair();
  return nacl.box.before(
    bs58.decode(phantomPubkeyB58),  // their public key
    bs58.decode(dapp.secretKey),    // our secret key
  );
}

/**
 * Encrypts a JSON payload for sending to Phantom.
 *
 * Returns:
 *   - nonce: 24-byte random value used to make each encryption unique.
 *            Must be passed to Phantom unencrypted so they can decrypt.
 *   - data:  the encrypted ciphertext.
 *
 * Both are base58-encoded for inclusion in URL parameters.
 */
function encryptPayload(payload: object, phantomPubkey: string) {
  const shared = getSharedSecret(phantomPubkey);
  // Random 24-byte nonce — required by NaCl, prevents replay attacks.
  const nonce = nacl.randomBytes(24);
  // nacl.box.after = symmetric encryption using the shared secret.
  const encrypted = nacl.box.after(
    Buffer.from(JSON.stringify(payload)),
    nonce,
    shared,
  );
  return {
    nonce: bs58.encode(nonce),
    data: bs58.encode(encrypted),
  };
}

/**
 * Decrypts a payload received from Phantom (via the redirect URL params).
 * Throws if decryption fails (wrong key, tampered ciphertext, etc).
 */
function decryptPayload(
  data: string,
  nonce: string,
  phantomPubkey: string,
): any {
  const shared = getSharedSecret(phantomPubkey);
  const decrypted = nacl.box.open.after(
    bs58.decode(data),
    bs58.decode(nonce),
    shared,
  );
  if (!decrypted) throw new Error("Failed to decrypt Phantom response");
  return JSON.parse(Buffer.from(decrypted).toString("utf8"));
}

/**
 * Removes Phantom's redirect-back query string from the URL after we've
 * processed it. Without this, refreshing the page would reprocess the same
 * response and (worse) leak sensitive params in browser history.
 */
function cleanUrlParams() {
  const url = new URL(window.location.href);
  url.search = "";
  window.history.replaceState({}, document.title, url.toString());
}

// =============================================================================
// SECTION 3 — Connect flow
// =============================================================================

/**
 * Builds the Phantom universal-link URL that initiates a connect handshake.
 *
 * When the user opens this URL on mobile:
 *   1. Phantom app opens
 *   2. User sees "CardBridger wants to connect" prompt
 *   3. User approves
 *   4. Phantom redirects back to redirect_link with these query params:
 *        - phantom_encryption_public_key: their public key (b58)
 *        - nonce: random nonce for the encrypted response (b58)
 *        - data: encrypted JSON containing { public_key, session }
 */
export function buildConnectUrl(redirectPath: string = "/dashboard"): string {
  const dapp = getOrCreateDappKeypair();
  const baseUrl = window.location.origin;
  const redirectLink = `${baseUrl}${redirectPath}`;

  const params = new URLSearchParams({
    // Our public key — Phantom uses this to derive the shared secret.
    dapp_encryption_public_key: dapp.publicKey,
    // Tells Phantom which Solana cluster to use for the wallet.
    cluster: "devnet",
    // Identifies our app to the user in the connect prompt.
    app_url: baseUrl,
    // Where Phantom should send the user back to after approval.
    redirect_link: redirectLink,
  });

  return `https://phantom.app/ul/v1/connect?${params.toString()}`;
}

/**
 * Should be called on every page load. If the URL contains Phantom's
 * connect-callback params, decrypt them, persist the session, and return
 * the user's public key + session token. Otherwise return null.
 *
 * Throws if Phantom returned an error code (user rejected, etc).
 */
export function handleConnectResponse(): {
  userPubkey: PublicKey;
  session: string;
} | null {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const phantomPubkey = url.searchParams.get("phantom_encryption_public_key");
  const nonce = url.searchParams.get("nonce");
  const data = url.searchParams.get("data");
  const errorCode = url.searchParams.get("errorCode");

  // Phantom signaled an error (user rejected, network issue, etc).
  if (errorCode) {
    const msg = url.searchParams.get("errorMessage") || "Phantom error";
    cleanUrlParams();
    throw new Error(`${msg} (code ${errorCode})`);
  }

  // Not a connect callback — these params come from connect responses only.
  if (!phantomPubkey || !nonce || !data) return null;

  // Decrypt the response. Phantom's public key (in URL) + our secret key
  // = shared secret. Use that to decrypt the data field.
  const decrypted = decryptPayload(data, nonce, phantomPubkey);
  const userPubkey = new PublicKey(decrypted.public_key);
  const session = decrypted.session;

  // Persist for future sign requests. Without this, every transaction
  // would require a fresh connect.
  localStorage.setItem(PHANTOM_PUBKEY, phantomPubkey);
  localStorage.setItem(SESSION, session);
  localStorage.setItem(USER_PUBKEY, userPubkey.toBase58());

  // Clean URL so refreshing doesn't reprocess the response.
  cleanUrlParams();
  return { userPubkey, session };
}

// =============================================================================
// SECTION 4 — Sign transaction flow (NOT signAndSend — that's deprecated)
// =============================================================================

/**
 * Sends a transaction to Phantom for signing via deep link.
 *
 * IMPORTANT: This does NOT broadcast the tx. Phantom signs and returns
 * the signed tx via the redirect URL. The CALLER must then broadcast it
 * via connection.sendRawTransaction.
 *
 * Why signTransaction instead of signAndSendTransaction:
 *   - signAndSendTransaction is deprecated.
 *   - signAndSendTransaction silently fails on devnet — only works on mainnet.
 *
 * Flow:
 *   1. Set blockhash + feePayer on tx (required for serialization).
 *   2. Serialize tx WITHOUT requiring signatures (Phantom adds them).
 *   3. Encrypt the serialized tx + session token under shared secret.
 *   4. Open Phantom URL — phone redirects to Phantom app.
 *   5. (User approves in Phantom)
 *   6. Phantom redirects back with encrypted signed tx in URL params.
 *   7. Caller's redirect handler decrypts and broadcasts (handleSignResponse).
 */
export async function signViaPhantom(
  tx: Transaction | VersionedTransaction,
  connection: Connection,
  redirectPath: string,
): Promise<void> {
  const { phantomPubkey, session, userPubkey } = getStoredSession();
  if (!phantomPubkey || !session || !userPubkey) {
    throw new Error("Not connected to Phantom. Connect first.");
  }

  let serialized: Uint8Array;

  if (tx instanceof Transaction) {
    // Phantom needs a blockhash to know the tx is recent.
    // We fetch JIT (just-in-time) right before signing — Solana blockhashes
    // expire after ~60 seconds, so we want a fresh one.
    if (!tx.recentBlockhash) {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
    }
    // Solana requires every tx to have a fee payer. The user pays.
    if (!tx.feePayer) tx.feePayer = userPubkey;

    // Serialize the unsigned tx. Critical flags:
    //   requireAllSignatures: false — tx isn't signed yet, that's Phantom's job.
    //   verifySignatures: false     — same reason.
    serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
  } else {
    // For VersionedTransaction, blockhash and fee payer are compiled in.
    serialized = tx.serialize();
  }

  // Build the payload Phantom expects:
  //   session: their token, proves we're an authorized dapp.
  //   transaction: base58-encoded serialized tx.
  const payload = {
    session,
    transaction: bs58.encode(serialized),
  };

  // Encrypt the payload — Phantom decrypts using the same shared secret.
  const dapp = getOrCreateDappKeypair();
  const { nonce, data } = encryptPayload(payload, phantomPubkey);

  // Build the deep-link URL.
  const baseUrl = window.location.origin;
  const params = new URLSearchParams({
    dapp_encryption_public_key: dapp.publicKey,
    nonce,
    redirect_link: `${baseUrl}${redirectPath}`,
    payload: data,
  });

  // Note the URL path: /signTransaction (NOT /signAndSendTransaction).
  // Tells Phantom to sign and return — don't broadcast.
  window.location.href =
    `https://phantom.app/ul/v1/signTransaction?${params.toString()}`;
  // The redirect happens immediately. Code after this line never runs.
}

/**
 * Should be called on every page load. If the URL contains Phantom's
 * signTransaction-callback params, decrypt them and return the SIGNED
 * transaction (base58-encoded). Otherwise return null.
 *
 * Returns:
 *   { signedTxBase58 } — caller must broadcast via connection.sendRawTransaction.
 */
export function handleSignResponse(): { signedTxBase58: string } | null {
  if (typeof window === "undefined") return null;



  const url = new URL(window.location.href);

    console.log(
    "[handleSignResponse] full URL",
    window.location.href,
  );
  console.log(
    "[handleSignResponse] data param:",
    url.searchParams.get("data")?.slice(0, 30) + "…",
  );
  console.log(
    "[handleSignResponse] nonce param:",
    url.searchParams.get("nonce"),
  );



  const data = url.searchParams.get("data");
  const nonce = url.searchParams.get("nonce");
  const errorCode = url.searchParams.get("errorCode");



  // Phantom signaled an error (e.g. user rejected the tx).
  if (errorCode) {
    const msg = url.searchParams.get("errorMessage") || "Phantom error";
    cleanUrlParams();
    throw new Error(`${msg} (code ${errorCode})`);
  }

  // Not a sign callback.
  if (!data || !nonce) return null;

  const { phantomPubkey } = getStoredSession();
  if (!phantomPubkey) throw new Error("No Phantom session");

  // Decrypt — payload format from Phantom is { transaction: "<b58 signed tx>" }
  const decrypted = decryptPayload(data, nonce, phantomPubkey);
  cleanUrlParams();

  // signTransaction returns the signed tx — caller must broadcast.
  // (signAndSendTransaction would have returned { signature: "..." } instead,
  // but that method is deprecated and broken on devnet.)
  return { signedTxBase58: decrypted.transaction };
}