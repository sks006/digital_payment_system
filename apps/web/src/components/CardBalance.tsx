"use client";

import { TrendingUp, TrendingDown, DollarSign, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import type { TokenBalance } from "@/lib/solana";
import Link from "next/link";

interface CardBalanceProps {
  totalPortfolioUsd: number;
  availableCredit: number;
  tokens: TokenBalance[];
  loading?: boolean;
  onRefresh?: () => void;
}

const TOKEN_COLORS: Record<string, string> = {
  SOL: "bg-zinc-900",
  USDC: "bg-zinc-700",
  USDT: "bg-zinc-600",
  ETH: "bg-zinc-500",
  BTC: "bg-zinc-400",
};

export default function CardBalance({
  totalPortfolioUsd,
  availableCredit,
  tokens,
  loading,
  onRefresh,
}: CardBalanceProps) {
  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-5 bg-secondary rounded w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-12 bg-secondary rounded" />
          <div className="h-20 bg-secondary rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            Portfolio Balance
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            className="h-7 w-7"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total value */}
        <div>
          <p className="text-4xl font-bold">
            {formatCurrency(totalPortfolioUsd)}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-xs text-zinc-500">+2.34% today</span>
          </div>
        </div>

        {/* Available Credit */}
        <div className="p-3 rounded-lg bg-secondary border border-border">
          <p className="text-xs text-muted-foreground mb-1">Available Credit</p>
          <p className="text-xl font-semibold text-foreground">
            {formatCurrency(availableCredit)}
          </p>
        </div>

        {/* Token breakdown */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            Assets
          </p>
          {tokens.map((token) => (
            <div
              key={token.mint}
              className="flex items-center justify-between py-2"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold",
                    TOKEN_COLORS[token.symbol] || "bg-secondary"
                  )}
                >
                  {token.symbol.slice(0, 2)}
                </div>
                <div>
                  <p className="text-sm font-medium">{token.symbol}</p>
                  <p className="text-xs text-muted-foreground">
                    {token.balance.toFixed(token.decimals > 6 ? 4 : 2)}{" "}
                    {token.symbol}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {formatCurrency(token.usdValue)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {((token.usdValue / totalPortfolioUsd) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          className="w-full mt-4 active:scale-[0.98] transition-transform"
          asChild
        >
          <Link href="/swap">
            Swap
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
