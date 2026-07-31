"use client";

import {
  ShoppingBag,
  ArrowDownLeft,
  ArrowUpRight,
  Repeat,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import type { AppTransaction as Transaction } from "@/lib/anchor-client";
import { useState, useEffect } from "react";

interface TransactionsProps {
  transactions: Transaction[];
  loading?: boolean;
}

const TX_ICONS: Record<string, any> = {
  purchase: ShoppingBag,
  topup: ArrowDownLeft,
  cashback: TrendingUp,
  swap: Repeat,
  interest: TrendingUp,
};

const TX_COLORS: Record<string, string> = {
  purchase: "text-foreground bg-secondary",
  topup: "text-foreground bg-secondary",
  cashback: "text-foreground bg-secondary",
  swap: "text-foreground bg-secondary",
  interest: "text-foreground bg-secondary",
};

const STATUS_ICONS: Record<string, any> = {
  completed: CheckCircle,
  pending: Clock,
  failed: XCircle,
};

const STATUS_COLORS: Record<string, string> = {
  completed: "text-muted-foreground",
  pending: "text-muted-foreground",
  failed: "text-muted-foreground",
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function Transactions({ transactions, loading }: TransactionsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-5 bg-secondary rounded w-40 animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-secondary rounded-lg animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {transactions.map((tx) => {
            const Icon = (TX_ICONS as any)[tx.type] || ShoppingBag;
            const iconClass = (TX_COLORS as any)[tx.type] || "text-muted-foreground bg-secondary";
            const StatusIcon = (STATUS_ICONS as any)[tx.status];
            const statusColor = (STATUS_COLORS as any)[tx.status];
            const isPositive = tx.amount > 0;

            return (
              <div
                key={tx.id}
                className="flex items-center gap-3 px-6 py-3.5 hover:bg-secondary/30 transition-colors"
              >
                {/* Icon */}
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0", iconClass)}>
                  <Icon className="w-4 h-4" />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    {tx.txHash && (
                      <a
                        href={`https://solscan.io/tx/${tx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {tx.merchant || (mounted ? formatTimeAgo(tx.timestamp) : "...")}
                    </span>
                    {tx.merchant && (
                      <span className="text-xs text-muted-foreground">·</span>
                    )}
                    {tx.merchant && (
                      <span className="text-xs text-muted-foreground">
                        {mounted ? formatTimeAgo(tx.timestamp) : "..."}
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount & Status */}
                <div className="text-right shrink-0">
                  <p
                    className={cn(
                      "text-sm font-semibold tabular-nums text-foreground"
                    )}
                  >
                    {isPositive ? "+" : ""}{formatCurrency(tx.amount)}
                  </p>
                  <div className={cn("flex items-center justify-end gap-1 mt-0.5", statusColor)}>
                    <StatusIcon className="w-3 h-3" />
                    <span className="text-xs capitalize">{tx.status}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
