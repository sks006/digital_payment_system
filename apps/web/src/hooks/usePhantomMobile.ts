"use client";

// =============================================================================
// usePhantomMobile — React hook wrapping the deep-link service
// =============================================================================
//
// Provides reactive state for the deep-link wallet:
//   - publicKey:        the connected user's Solana address (or null)
//   - connected:        boolean shorthand
//   - connect():        triggers redirect to Phantom for connect handshake
//   - disconnect():     clears local session
//   - pendingSignedTx:  signed tx waiting to be broadcast (after sign callback)
//   - error:            most recent error, if any
//
// Lifecycle:
//   1. On mount, check if URL has Phantom callback params (connect or sign).
//      If yes, process them and update state.
//   2. Also check if a session is already stored from a previous session.
//   3. Expose connect/disconnect functions that trigger redirects.
//
// =============================================================================

import { useEffect, useState, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  buildConnectUrl,
  handleConnectResponse,
  handleSignResponse,
  getStoredSession,
  clearSession,
} from "@/lib/phantom-deeplink";

export function usePhantomMobile() {
  // State — driven by URL params on first render and connect/disconnect calls.
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);

  // pendingSignedTx is the signed transaction Phantom returned, base58-encoded.
  // The caller (e.g. DepositCollateral) consumes this and broadcasts via
  // connection.sendRawTransaction.
  const [pendingSignedTx, setPendingSignedTx] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  // Run ONCE on mount. We check three sources, in priority order:
  //   1. Connect callback in URL (just came back from Phantom connect).
  //   2. Sign callback in URL (just came back from Phantom signTransaction).
  //   3. Existing stored session (visited the site again, already connected).
  useEffect(() => {
    try {
      // Was this page load triggered by a Phantom connect redirect?
      // If yes, decrypt the params, store the session, set publicKey.
      const connectResult = handleConnectResponse();
      if (connectResult) {
        setPublicKey(connectResult.userPubkey);
        return; // Don't bother checking other sources — connect always wins.
      }

      // Was this page load triggered by a Phantom signTransaction redirect?
      // If yes, decrypt the signed tx and store it for the caller to broadcast.
      const signResult = handleSignResponse();
      if (signResult) {
        setPendingSignedTx(signResult.signedTxBase58);
      }

      // Even if a sign callback was present, we still want publicKey set.
      // Pull from localStorage (persisted across page loads).
      const stored = getStoredSession();
      if (stored.userPubkey) setPublicKey(stored.userPubkey);
    } catch (e: any) {
      // Phantom returned an error code, or decryption failed.
      setError(e.message);
    }
  }, []); // empty deps — run once.

  /**
   * Initiate a connect handshake.
   * Redirects to Phantom — page will reload after user approves.
   */
  const connect = useCallback((redirectPath = "/dashboard") => {
    window.location.href = buildConnectUrl(redirectPath);
  }, []);

  /**
   * Clear the local session. Doesn't notify Phantom — the user can still
   * see this dapp in their connected dapps list. Most demos accept that.
   */
  const disconnect = useCallback(() => {
    clearSession();
    setPublicKey(null);
  }, []);

  /**
   * Consume the pendingSignedTx — returns the signed tx string AND clears it
   * from state so subsequent renders don't re-broadcast.
   *
   * Caller pattern:
   *   useEffect(() => {
   *     if (wallet.pendingSignedTx) {
   *       const signed = wallet.consumePendingSignedTx();
   *       broadcastAndConfirm(signed);  // user-defined
   *     }
   *   }, [wallet.pendingSignedTx]);
   */
  const consumePendingSignedTx = useCallback(() => {
    const tx = pendingSignedTx;
    setPendingSignedTx(null);
    return tx;
  }, [pendingSignedTx]);

  return {
    publicKey,
    connected: !!publicKey,
    connect,
    disconnect,
    pendingSignedTx,
    consumePendingSignedTx,
    error,
  };
}