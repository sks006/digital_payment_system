"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Zap,
  CreditCard,
  ArrowUpRight,
  ArrowLeftRight,
  Plus,
  SnowflakeIcon,
  Bell,
  TrendingUp,
  Wallet,
  Camera,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Header from "@/components/digital_payment_system/Header";
import Footer from "@/components/digital_payment_system/Footer";
import HealthFactorMeter from "@/components/HealthFactorMeter";
import CardBalance from "@/components/CardBalance";
import Transactions from "@/app/dashboard/transactions";
import { useHealthFactor } from "@/hooks/useHealthFactor";
import { useCardBalance } from "@/hooks/useCardBalance";
import { formatCurrency, shortenAddress } from "@/lib/utils";
import type { AppTransaction } from "@/lib/anchor-client";

import { useEffectiveWallet } from "@/hooks/useEffectiveWallet";
import { useAnchorProvider } from "@/hooks/useAnchorProvider";

const MOCK_WALLET = "8xK9mBzLpQRnVwT3cY7dFhJeN2sAuXiCvMoP4gS5tEq";

export default function DashboardPage() {
  const wallet = useEffectiveWallet();
  const provider = useAnchorProvider();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const walletAddress = wallet.publicKey?.toBase58() || MOCK_WALLET;

  const healthFactor = useHealthFactor(walletAddress);
  const cardBalance = useCardBalance(walletAddress);
  
  const [transactions, setTransactions] = useState<AppTransaction[]>([]);
  const [cardState, setCardState] = useState({
    cardNumber: "•••• •••• •••• 4291",
    expiryDate: "09/27",
    isFrozen: false,
    mode: "credit" as const,
    spendingLimit: 2500,
    currentDaySpend: 0,
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const DEFAULT_TRANSACTIONS: AppTransaction[] = [
        {
          id: "tx-1",
          type: "purchase",
          status: "completed",
          amount: -120.00,
          description: "Zara Fashion",
          timestamp: new Date(Date.now() - 3600000 * 2),
          merchant: "Zara",
        },
        {
          id: "tx-2",
          type: "cashback",
          status: "completed",
          amount: 2.40,
          description: "2% Cashback - Zara",
          timestamp: new Date(Date.now() - 3600000 * 2),
        },
        {
          id: "tx-3",
          type: "topup",
          status: "completed",
          amount: 120.00,
          description: "Solana Collateral Deposit",
          timestamp: new Date(Date.now() - 3600000 * 24),
        },
        {
          id: "tx-4",
          type: "purchase",
          status: "completed",
          amount: -45.50,
          description: "Starbucks Coffee",
          timestamp: new Date(Date.now() - 3600000 * 48),
          merchant: "Starbucks",
        },
        {
          id: "tx-5",
          type: "cashback",
          status: "completed",
          amount: 0.91,
          description: "2% Cashback - Starbucks",
          timestamp: new Date(Date.now() - 3600000 * 48),
        }
      ];

      const stored = localStorage.getItem("digital_payment_system:transactions");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const formatted = parsed.map((t: any) => ({
            ...t,
            timestamp: new Date(t.timestamp),
          }));
          setTransactions(formatted);
        } catch (e) {
          console.error(e);
        }
      } else {
        localStorage.setItem("digital_payment_system:transactions", JSON.stringify(DEFAULT_TRANSACTIONS));
        setTransactions(DEFAULT_TRANSACTIONS);
      }
    }
  }, []);

  const monthlySpend = transactions
    .filter((t) => t.type === "purchase" && t.status === "completed")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalCashback = transactions
    .filter((t) => t.type === "cashback")
    .reduce((sum, t) => sum + t.amount, 0);

  const monthlyTopup = transactions
    .filter((t) => t.type === "topup" && t.status === "completed")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const rawHealthFactor = healthFactor.healthFactor;
  const displayHealthFactor = rawHealthFactor >= 9999
    ? (cardBalance.totalPortfolioUsd > 0 ? (cardBalance.tokens.find(t => t.symbol === "SOL")?.usdValue ?? 0) * 0.8 / 380.5 : 4.44)
    : rawHealthFactor;

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Wallet:{" "}
              <span className="font-mono text-foreground">
                {shortenAddress(walletAddress)}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/card">
                <SnowflakeIcon className="w-4 h-4" />
                Manage Card
              </Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link href="/card">
                <Plus className="w-4 h-4" />
                Top Up
              </Link>
            </Button>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Available Credit",
              value: formatCurrency(cardBalance.balance?.availableCredit ?? 0),
              change: `+${formatCurrency(monthlyTopup)} this month`,
              positive: false,
              icon: Wallet,
              color: "text-foreground",
              bg: "bg-secondary",
            },
            {
              label: "Monthly Spend",
              value: formatCurrency(monthlySpend),
              change: cardState.spendingLimit > 0 ? `${((monthlySpend / cardState.spendingLimit) * 100).toFixed(0)}% of limit` : "0% of limit",
              positive: false,
              icon: CreditCard,
              color: "text-foreground",
              bg: "bg-secondary",
            },
            {
              label: "Total Cashback",
              value: `+${formatCurrency(totalCashback)}`,
              change: "2% on purchases",
              positive: false,
              icon: TrendingUp,
              color: "text-foreground",
              bg: "bg-secondary",
            },
            {
              label: "Health Factor",
              value: displayHealthFactor.toFixed(2),
              change: healthFactor.riskLabel,
              positive: false,
              icon: Zap,
              color: healthFactor.riskColor,
              bg: "bg-secondary",
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <div className={`w-7 h-7 rounded-lg ${stat.bg} flex items-center justify-center`}>
                      <Icon className={`w-3.5 h-3.5 text-muted-foreground`} />
                    </div>
                  </div>
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className={`text-xs mt-1 text-muted-foreground`}>
                    {stat.change}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Mock Card Visual + Card State */}
          <div className="lg:col-span-1 space-y-4">
            {/* Card Visual */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-300/20 to-zinc-400/20 dark:from-zinc-800/20 dark:to-zinc-900/20 rounded-2xl blur-xl scale-105" />
              <div
                className="relative rounded-2xl overflow-hidden border border-white/10 shadow-xl"
                style={{
                  background: "linear-gradient(135deg, #18181b 0%, #27272a 50%, #09090b 100%)",
                  aspectRatio: "1.586/1",
                }}
              >
                <div className="absolute inset-0 card-shimmer" />
                <div className="relative h-full p-5 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-zinc-950 dark:bg-zinc-50 flex items-center justify-center">
                        <Zap className="w-3 h-3 text-zinc-50 dark:text-zinc-950" />
                      </div>
                      <span className="font-bold text-white text-sm tracking-wider">Digital Payment System</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {cardState.isFrozen && (
                        <Badge variant="secondary" className="text-xs">
                          <SnowflakeIcon className="w-3 h-3 mr-1" />
                          Frozen
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {cardState.mode === "credit" ? "Credit" : "Debit"}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-white/80 font-mono text-sm tracking-[0.15em]">
                      {cardState.cardNumber}
                    </p>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Holder</p>
                        <p className="text-white text-xs font-medium">CRYPTO USER</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/40 text-xs uppercase tracking-wider mb-0.5">Exp</p>
                        <p className="text-white text-xs font-medium">{cardState.expiryDate}</p>
                      </div>
                      <div className="flex -space-x-2">
                        <div className="w-7 h-7 rounded-full bg-zinc-700/80" />
                        <div className="w-7 h-7 rounded-full bg-zinc-400/80" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card Quick Info */}
            <Card className="border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Daily Limit</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(cardState.currentDaySpend)} / {formatCurrency(cardState.spendingLimit)}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-zinc-950 dark:bg-zinc-50 rounded-full transition-all"
                    style={{ width: `${(cardState.currentDaySpend / cardState.spendingLimit) * 100}%` }}
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" asChild>
                    <Link href="/card">
                      <SnowflakeIcon className="w-3.5 h-3.5" />
                      Freeze
                    </Link>
                  </Button>
                  <Button variant="default" size="sm" className="flex-1" asChild>
                    <Link href="/card">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Top Up
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Health Factor */}
            <HealthFactorMeter
              position={healthFactor.position}
              healthFactor={healthFactor.healthFactor}
              riskLevel={healthFactor.riskLevel}
              riskColor={healthFactor.riskColor}
              riskLabel={healthFactor.riskLabel}
              loading={healthFactor.loading}
            />
          </div>

          {/* Balance + Transactions */}
          <div className="lg:col-span-2 space-y-6">
            <CardBalance
              totalPortfolioUsd={cardBalance.totalPortfolioUsd}
              availableCredit={cardBalance.balance?.availableCredit ?? 0}
              tokens={cardBalance.tokens}
              loading={cardBalance.loading}
              onRefresh={cardBalance.refresh}
            />

            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-3">
              <Button variant="outline" className="h-14 flex-col gap-1" asChild>
                <Link href="/swap">
                  <ArrowLeftRight className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs font-medium">Swap</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-14 flex-col gap-1" asChild>
                <Link href="/qr-pay">
                  <Camera className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs font-medium">QR Pay</span>
                </Link>
              </Button>
              <Button variant="outline" className="h-14 flex-col gap-1" asChild>
                <Link href="/pos-simulator">
                  <Store className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs font-medium">POS Sim</span>
                </Link>
              </Button>
            </div>

            <Transactions transactions={transactions} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}



