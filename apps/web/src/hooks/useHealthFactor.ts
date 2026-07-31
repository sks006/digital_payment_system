"use client";

import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { useAnchorProvider } from "./useAnchorProvider";
import { useSolPrice } from "./useSolPrice";
import { useEffectiveWallet } from "./useEffectiveWallet";
import { fetchUserPosition, type CollateralPosition } from "@/lib/anchor-client";

export interface HealthFactorState {
  position: CollateralPosition | null;
  healthFactor: number;
  riskLevel: "safe" | "moderate" | "warning" | "critical";
  riskColor: string;
  riskLabel: string;
  loading: boolean;
  error: string | null;
  solPriceUsd: number | null;
  refresh: () => void;
}

function getRiskLevel(hf: number) {
  if (hf >= 2.0) return { level: "safe", color: "text-zinc-900 dark:text-zinc-100", label: "Safe" } as const;
  if (hf >= 1.5) return { level: "moderate", color: "text-zinc-600 dark:text-zinc-400", label: "Moderate" } as const;
  if (hf >= 1.1) return { level: "warning", color: "text-zinc-400 dark:text-zinc-500", label: "At Risk" } as const;
  return { level: "critical", color: "text-zinc-300 dark:text-zinc-600", label: "Critical" } as const;
}

export function useHealthFactor(address?: string): HealthFactorState {
  const wallet = useEffectiveWallet();
  const provider = useAnchorProvider();
  const { solUsd, eurUsd, loading: priceLoading, error: priceError } = useSolPrice();

  const [position, setPosition] = useState<CollateralPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosition = useCallback(async () => {
    const targetAddress = address ?? wallet.publicKey?.toBase58();
    if (!targetAddress || !provider || !solUsd || !eurUsd) return;

    setLoading(true);
    setError(null);
    try {
      const pubkey = new PublicKey(targetAddress);
      const pos = await fetchUserPosition(pubkey, provider, solUsd, eurUsd);
      setPosition(pos);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [address, wallet.publicKey, provider, solUsd, eurUsd]);

  useEffect(() => {
    fetchPosition();
    const interval = setInterval(fetchPosition, 15_000);
    return () => clearInterval(interval);
  }, [fetchPosition]);

  const healthFactor = position?.healthFactor ?? (wallet.connected ? 9999 : 0);
  const risk = getRiskLevel(healthFactor);

  return {
    position,
    healthFactor,
    riskLevel: risk.level,
    riskColor: risk.color,
    riskLabel: risk.label,
    loading: loading || priceLoading,
    error: error || priceError,
    solPriceUsd: solUsd,
    refresh: fetchPosition,
  };
}