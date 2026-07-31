"use client";

import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Transaction, VersionedTransaction, PublicKey } from "@solana/web3.js";
import { useMemo } from "react";
import { usePhantomMobile } from "./usePhantomMobile";

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

class DeeplinkReadOnlyWallet implements Wallet {
  constructor(private pubkey: PublicKey) {}
  get publicKey() { return this.pubkey; }
  get payer(): never {
    throw new Error("payer not available on deep-link wallet");
  }
  async signTransaction<T extends Transaction | VersionedTransaction>(_tx: T): Promise<T> {
    throw new Error("Deep-link wallet cannot signTransaction — use wallet.signAndSend instead");
  }
  async signAllTransactions<T extends Transaction | VersionedTransaction>(_txs: T[]): Promise<T[]> {
    throw new Error("Deep-link wallet cannot signAllTransactions — use wallet.signAndSend instead");
  }
}

export function useAnchorProvider(): AnchorProvider | null {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const phantomMobile = usePhantomMobile();

  return useMemo(() => {
    if (anchorWallet) {
      return new AnchorProvider(connection, anchorWallet, {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      });
    }

    const usingDeeplink =
      isMobile() &&
      typeof window !== "undefined" &&
      !(window as any).phantom?.solana?.isPhantom;

    if (usingDeeplink && phantomMobile.publicKey) {
      const readOnlyWallet = new DeeplinkReadOnlyWallet(phantomMobile.publicKey);
      return new AnchorProvider(connection, readOnlyWallet, {
        commitment: "confirmed",
        preflightCommitment: "confirmed",
      });
    }

    return null;
  }, [connection, anchorWallet, phantomMobile.publicKey]);
}