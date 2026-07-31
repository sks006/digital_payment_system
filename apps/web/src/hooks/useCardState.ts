"use client";

import { useState, useEffect, useCallback } from "react";
import { useAnchorProvider } from "./useAnchorProvider";
import { useSolPrice } from "./useSolPrice";
import { useEffectiveWallet } from "./useEffectiveWallet";
import { fetchUserPosition } from "@/lib/anchor-client";
import { shortenAddress } from "@/lib/utils";

export interface DynamicCardState {
  cardNumber: string;
  mode: "credit" | "debit";
  availableCredit: number;
  totalCollateral: number;
  healthFactor: number;
  isFrozen: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCardState(): DynamicCardState {
  const wallet = useEffectiveWallet();
  const provider = useAnchorProvider();
  const { solUsd, eurUsd, loading: priceLoading } = useSolPrice();

  const [state, setState] = useState<DynamicCardState>({
    cardNumber: "Connect Wallet",
    mode: "credit",
    availableCredit: 0,
    totalCollateral: 0,
    healthFactor: 0,
    isFrozen: false,
    isLoading: false,
    error: null,
    refresh: () => {},
  });

  const refresh = useCallback(async () => {
    if (!wallet.connected || !wallet.publicKey || !provider) {
      setState((s) => ({
        ...s,
        cardNumber: "Connect Wallet",
        isLoading: false,
        availableCredit: 0,
      }));
      return;
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      if (!solUsd || !eurUsd) return;
      const pos = await fetchUserPosition(wallet.publicKey, provider, solUsd, eurUsd);
      if (pos) {
        setState((s) => ({
          ...s,
          cardNumber: shortenAddress(wallet.publicKey!.toBase58()),
          mode: pos.borrowedAmount > 0 ? "credit" : "debit",
          availableCredit: pos.maxBorrowable,
          totalCollateral: pos.collateralUsdValue,
          healthFactor: pos.healthFactor,
          isFrozen: false,
          isLoading: false,
          error: null,
        }));
      } else {
        setState((s) => ({
          ...s,
          cardNumber: shortenAddress(wallet.publicKey!.toBase58()),
          mode: "debit",
          availableCredit: 0,
          totalCollateral: 0,
          healthFactor: 0,
          isLoading: false,
          error: null,
        }));
      }
    } catch (e: any) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: e.message || "Failed to load card data",
      }));
    }
  }, [wallet.connected, wallet.publicKey, provider, solUsd, eurUsd]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { ...state, refresh };
}