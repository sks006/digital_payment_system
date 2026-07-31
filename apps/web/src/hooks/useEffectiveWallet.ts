"use client";

// =============================================================================
// useEffectiveWallet — unified wallet abstraction
// =============================================================================
//
// On mobile Chrome, our wallet lives in the deep-link flow (no provider injection).
// On desktop and inside Phantom's in-app browser, the wallet lives in the
// standard wallet adapter.
//
// This hook returns a single `EffectiveWallet` object that hides which path
// is active. Components just call `wallet.signAndSend(tx)` and the hook routes
// it to the right place.
//
// IMPORTANT: signAndSend is asymmetric:
//   - On desktop:  signs + broadcasts + confirms, returns final signature.
//   - On deep-link: redirects away. Returns by throwing "Redirecting to Phantom"
//                   (caller catches and ignores). The signed tx comes back later
//                   via wallet.pendingSignedTx, which the component then
//                   broadcasts itself.
//
// =============================================================================

import { useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction, PublicKey } from "@solana/web3.js";
import { usePhantomMobile } from "./usePhantomMobile";
import { signViaPhantom } from "@/lib/phantom-deeplink";

/**
 * True if user agent looks like Android/iOS. Used to decide whether to
 * activate the deep-link flow.
 */
function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Public type — what every component sees.
export interface EffectiveWallet {
  publicKey: PublicKey | null;
  connected: boolean;

  /** True when we're using Phantom deep-link (mobile Chrome path). */
  isDeeplink: boolean;

  /**
   * Sign and send a transaction.
   *
   * On desktop: returns the signature when confirmed.
   * On deep-link: redirects to Phantom and never returns (throws to escape).
   *               The signed tx will be available later via pendingSignedTx,
   *               which the caller must consume and broadcast.
   */
  signAndSend: (tx: Transaction, redirectPath?: string) => Promise<string>;

  /** The signed transaction returned from a deep-link sign (deep-link path only). */
  pendingSignedTx: string | null;

  /** Pulls and clears pendingSignedTx in one call. */
  consumePendingSignedTx: () => string | null;
}

export function useEffectiveWallet(): EffectiveWallet {
  // Standard wallet adapter (desktop / Phantom in-app browser).
  const std = useWallet();
  const { connection } = useConnection();

  // Deep-link wallet (mobile Chrome).
  const phantomMobile = usePhantomMobile();

  // Decide the active path ONCE — doesn't change without a page reload.
  // Conditions for deep-link:
  //   - Mobile user agent (Android or iOS), AND
  //   - No window.phantom injection (so we're NOT in Phantom's in-app browser).
  // If both conditions are false, we use the standard adapter.
  const isDeeplink = useMemo(
    () =>
      isMobile() &&
      typeof window !== "undefined" &&
      !(window as any).phantom?.solana?.isPhantom,
    [],
  );

  // Build the EffectiveWallet object based on the active path.
  return useMemo<EffectiveWallet>(() => {
    if (isDeeplink) {
      // ---- Deep-link path ----
      return {
        publicKey: phantomMobile.publicKey,
        connected: phantomMobile.connected,
        isDeeplink: true,

        signAndSend: async (tx, redirectPath) => {
          // signViaPhantom redirects to Phantom — page is unloaded.
          // We throw to give the caller a synchronous escape; the actual
          // signature comes back later via pendingSignedTx.
          await signViaPhantom(
            tx,
            connection,
            redirectPath ?? window.location.pathname,
          );
          // If we somehow reach this line, the redirect didn't happen.
          throw new Error("Redirecting to Phantom...");
        },

        pendingSignedTx: phantomMobile.pendingSignedTx,
        consumePendingSignedTx: phantomMobile.consumePendingSignedTx,
      };
    }

    // ---- Standard adapter path (desktop / Phantom in-app browser) ----
    return {
      publicKey: std.publicKey ?? null,
      connected: std.connected,
      isDeeplink: false,

      signAndSend: async (tx) => {
        if (!std.publicKey || !std.signTransaction) {
          throw new Error("Wallet not connected");
        }
        // Set blockhash + fee payer just-in-time.
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash("confirmed");
        tx.recentBlockhash = blockhash;
        tx.feePayer = std.publicKey;

        // Wallet adapter handles the user prompt + signature.
        const signed = await std.signTransaction(tx);

        // Broadcast.
        const signature = await connection.sendRawTransaction(
          signed.serialize(),
          { skipPreflight: false, preflightCommitment: "confirmed" },
        );

        // Wait for confirmation before returning.
        await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed",
        );
        return signature;
      },

      // No deep-link state on desktop.
      pendingSignedTx: null,
      consumePendingSignedTx: () => null,
    };
  }, [
    isDeeplink,
    std.publicKey,
    std.connected,
    std.signTransaction,
    phantomMobile.publicKey,
    phantomMobile.connected,
    phantomMobile.pendingSignedTx,
    phantomMobile.consumePendingSignedTx,
    connection,
  ]);
}