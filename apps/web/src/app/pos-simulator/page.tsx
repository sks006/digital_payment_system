"use client";

import { useState, useEffect } from "react";
import { useWallet } from '@solana/wallet-adapter-react';
import {
  ShoppingCart,
  CreditCard,
  Loader2,
  CheckCircle,
  XCircle,
  Store,
  Coffee,
  Car,
  Plane,
  Tv,
  Dumbbell,
  ExternalLink,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Header from "@/components/digital_payment_system/Header";
import Footer from "@/components/digital_payment_system/Footer";
import { swipeCard, type SwipeResponse } from "@/lib/api-client";
import { formatCurrency, shortenAddress } from "@/lib/utils";
import { useCardState } from "@/hooks/useCardState";

interface Merchant {
  name: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  amounts: number[];
  color: string;
  bg: string;
}

const MERCHANTS: Merchant[] = [
  {
    name: "Starbucks",
    category: "Food & Beverage",
    icon: Coffee,
    amounts: [5.5, 8.75, 12.0],
    color: "text-foreground",
    bg: "bg-secondary border-border",
  },
  {
    name: "Amazon",
    category: "Online Shopping",
    icon: Store,
    amounts: [29.99, 89.99, 199.99],
    color: "text-foreground",
    bg: "bg-secondary border-border",
  },
  {
    name: "Netflix",
    category: "Entertainment",
    icon: Tv,
    amounts: [15.99, 22.99],
    color: "text-foreground",
    bg: "bg-secondary border-border",
  },
  {
    name: "Shell Gas Station",
    category: "Automotive",
    icon: Car,
    amounts: [35.0, 52.5, 78.0],
    color: "text-foreground",
    bg: "bg-secondary border-border",
  },
  {
    name: "Emirates Airlines",
    category: "Travel",
    icon: Plane,
    amounts: [249.0, 599.0, 1299.0],
    color: "text-foreground",
    bg: "bg-secondary border-border",
  },
  {
    name: "Equinox Gym",
    category: "Fitness",
    icon: Dumbbell,
    amounts: [30.0, 55.0, 185.0],
    color: "text-foreground",
    bg: "bg-secondary border-border",
  },
];

interface TransactionLog {
  id: string;
  merchant: string;
  amount: number;
  response: SwipeResponse;
  timestamp: Date;
}

export default function POSSimulatorPage() {
  const { publicKey, connected } = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { cardNumber, mode, availableCredit, isLoading: cardLoading } = useCardState();

  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [lastResponse, setLastResponse] = useState<SwipeResponse | null>(null);
  const [txLog, setTxLog] = useState<TransactionLog[]>([]);
  const [displayBalance, setDisplayBalance] = useState<number>(0);

  // Update display balance when availableCredit changes
  useEffect(() => {
    setDisplayBalance(availableCredit);
  }, [availableCredit]);

  const finalAmount = selectedAmount ?? parseFloat(customAmount) ?? 0;

  const handleSwipe = async () => {
    if (!selectedMerchant || !finalAmount || !publicKey) return;
    setProcessing(true);
    setLastResponse(null);

    const response = await swipeCard({
      merchantName: selectedMerchant.name,
      merchantCategory: selectedMerchant.category,
      amount: finalAmount,
      currency: "USD",
      walletAddress: publicKey.toBase58(),
    });

    setLastResponse(response);
    if (response.success) {
      // Update local balance after successful swipe
      setDisplayBalance(response.newBalance);
      setTxLog((prev) => [
        {
          id: response.transactionId,
          merchant: selectedMerchant.name,
          amount: finalAmount,
          response,
          timestamp: new Date(),
        },
        ...prev.slice(0, 9),
      ]);
    }
    setProcessing(false);
  };

  const resetTransaction = () => {
    setLastResponse(null);
    setSelectedAmount(null);
    setCustomAmount("");
  };

  if (!mounted) return null;

  // Show wallet connection prompt if not connected
  if (!connected || !publicKey) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Connect Wallet</CardTitle>
              <CardDescription>
                Please connect your Solana wallet to use the POS Simulator.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button variant="default" onClick={() => document.querySelector<HTMLButtonElement>('[data-testid="wallet-connect-button"]')?.click()}>
                Connect Wallet
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">POS Simulator</h1>
            <Badge variant="secondary">Demo Mode</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Simulate card swipes at real merchants. Uses your connected wallet:{" "}
            <code className="text-xs bg-secondary px-1.5 py-0.5 rounded font-mono">
              {shortenAddress(publicKey.toBase58())}
            </code>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* POS Terminal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Dynamic Card status bar */}
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center">
                      <Zap className="w-5 h-5 text-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Digital Payment System {cardNumber}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {mode} Mode · {cardLoading ? 'Loading...' : 'Active'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Available Credit</p>
                    <p className="text-lg font-bold text-foreground">
                      {cardLoading ? '—' : formatCurrency(displayBalance)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Merchant Selection */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Select Merchant
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {MERCHANTS.map((merchant) => {
                  const Icon = merchant.icon;
                  const isSelected = selectedMerchant?.name === merchant.name;
                  return (
                    <button
                      key={merchant.name}
                      onClick={() => {
                        setSelectedMerchant(merchant);
                        setSelectedAmount(null);
                        setCustomAmount("");
                        setLastResponse(null);
                      }}
                      className={`p-4 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                        isSelected
                          ? `${merchant.bg} border-current`
                          : "border-border bg-card hover:bg-secondary/30"
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-2 ${isSelected ? merchant.color : "text-muted-foreground"}`} />
                      <p className={`text-sm font-semibold ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                        {merchant.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {merchant.category}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount Selection */}
            {selectedMerchant && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Select Amount
                </h2>
                <div className="flex flex-wrap gap-2">
                  {selectedMerchant.amounts.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => { setSelectedAmount(amt); setCustomAmount(""); }}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                        selectedAmount === amt
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {formatCurrency(amt)}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">or custom:</span>
                  <div className="relative w-36">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={customAmount}
                      onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                      className="pl-7"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Swipe Button */}
            {selectedMerchant && (
              <div className="space-y-3">
                {/* Transaction preview */}
                {finalAmount > 0 && !lastResponse && (
                  <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Merchant</span>
                      <span className="font-medium">{selectedMerchant.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold">{formatCurrency(finalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cashback (2%)</span>
                      <span className="text-foreground">+{formatCurrency(finalAmount * 0.02)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Mode</span>
                      <Badge variant="secondary" className="text-xs">Credit</Badge>
                    </div>
                  </div>
                )}

                {/* Response */}
                {lastResponse && (
                  <div className="p-4 rounded-xl border border-border bg-secondary">
                    <div className="flex items-center gap-2 mb-2">
                      {lastResponse.success ? (
                        <CheckCircle className="w-5 h-5 text-foreground" />
                      ) : (
                        <XCircle className="w-5 h-5 text-muted-foreground" />
                      )}
                      <span className="font-semibold text-foreground">
                        {lastResponse.message}
                      </span>
                    </div>
                    {lastResponse.success && (
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Approved</span>
                          <span>{formatCurrency(lastResponse.approvedAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cashback</span>
                          <span className="text-foreground">+{formatCurrency(lastResponse.cashbackAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tx ID</span>
                          <span className="font-mono text-xs">{lastResponse.transactionId}</span>
                        </div>
                        {lastResponse.txHash && (
                          <a
                            href={`https://solscan.io/tx/${lastResponse.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs mt-1 underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View on Solscan
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  {lastResponse ? (
                    <Button variant="outline" onClick={resetTransaction} className="flex-1">
                      New Transaction
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      className="flex-1 h-12"
                      onClick={handleSwipe}
                      disabled={processing || !finalAmount}
                    >
                      {processing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          Swipe Card · {finalAmount > 0 ? formatCurrency(finalAmount) : "—"}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Transaction Log */}
          <div>
            <Card className="border-border sticky top-24">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-muted-foreground" />
                  Transaction Log
                </CardTitle>
                <CardDescription className="text-xs">
                  {txLog.length === 0
                    ? "No transactions yet"
                    : `${txLog.length} transaction${txLog.length !== 1 ? "s" : ""} this session`}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {txLog.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <CreditCard className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Simulate a transaction to see it here
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                    {txLog.map((tx) => (
                      <div key={tx.id} className="px-4 py-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium">{tx.merchant}</p>
                            <p className="text-xs text-muted-foreground font-mono">{tx.id}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{formatCurrency(tx.amount)}</p>
                            {tx.response.cashbackAmount > 0 && (
                              <p className="text-xs text-foreground">
                                +{formatCurrency(tx.response.cashbackAmount)} back
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <Badge
                            variant="secondary"
                            className="text-xs"
                          >
                            {tx.response.success ? "Approved" : "Declined"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {tx.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {txLog.length > 0 && (
                  <>
                    <Separator />
                    <div className="px-4 py-3 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Total Spent</span>
                        <span className="font-medium">
                          {formatCurrency(
                            txLog
                              .filter((t) => t.response.success)
                              .reduce((s, t) => s + t.amount, 0)
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Total Cashback</span>
                        <span className="text-foreground font-medium">
                          +{formatCurrency(
                            txLog.reduce((s, t) => s + t.response.cashbackAmount, 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
