"use client";

import { useState, useEffect } from "react";
import {
  SnowflakeIcon,
  Eye,
  EyeOff,
  Settings,
  Zap,
  ShieldCheck,
  CreditCard,
  Globe,
  Camera,
  Store,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import Header from "@/components/digital_payment_system/Header";
import Footer from "@/components/digital_payment_system/Footer";
import DepositCollateral from "@/components/digital_payment_system/DepositCollateral";
import { type CardState, type CollateralPosition } from "@/lib/anchor-client";
import { updateCardSettings } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

import { useEffectiveWallet } from "@/hooks/useEffectiveWallet";

export const dynamic = "force-dynamic";   // ← add this line

export default function CardPage() {
  const wallet = useEffectiveWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const walletAddress = wallet.publicKey?.toBase58();

  const [cardState, setCardState] = useState<CardState>({
    cardNumber: "•••• •••• •••• 4291",
    cvv: "•••",
    expiryDate: "09/27",
    isFrozen: false,
    mode: "credit",
    spendingLimit: 2500,
    currentDaySpend: 0,
    monthlySpend: 0,
  });

  const [position, setPosition] = useState<CollateralPosition>({
    owner: walletAddress || "",
    collateralMint: "",
    collateralSymbol: "SOL",
    collateralAmount: 0,
    collateralUsdValue: 0,
    borrowedAmount: 0,
    healthFactor: 9999,
    liquidationThreshold: 1.2,
    ltv: 0.8,
    maxBorrowable: 0,
    solPriceUsd: 0,
  });
  const [showDetails, setShowDetails] = useState(false);
  const [spendingLimit, setSpendingLimit] = useState([cardState.spendingLimit]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const toggleFreeze = async () => {
    if (!walletAddress) return;
    setSaving(true);
    await updateCardSettings({
      walletAddress,
      isFrozen: !cardState.isFrozen,
    });
    setCardState((prev) => ({ ...prev, isFrozen: !prev.isFrozen }));
    setSaving(false);
  };

  const toggleMode = async () => {
    if (!walletAddress) return;
    const newMode = cardState.mode === "credit" ? "debit" : "credit";
    setSaving(true);
    await updateCardSettings({ walletAddress, mode: newMode });
    setCardState((prev) => ({ ...prev, mode: newMode }));
    setSaving(false);
  };

  const saveSpendingLimit = async () => {
    if (!walletAddress) return;
    setSaving(true);
    await updateCardSettings({
      walletAddress,
      spendingLimit: spendingLimit[0],
    });
    setCardState((prev) => ({ ...prev, spendingLimit: spendingLimit[0] }));
    setSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Card Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your Digital Payment System Card settings, limits, and top up collateral
          </p>
        </div>

        <Tabs defaultValue="card" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="card">Card</TabsTrigger>
            <TabsTrigger value="limits">Limits</TabsTrigger>
            <TabsTrigger value="topup">Top Up</TabsTrigger>
          </TabsList>

          {/* Card Tab */}
          <TabsContent value="card" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card visual */}
              <div className="space-y-4">
                <div className="relative">
                  <div
                    className={`absolute inset-0 rounded-2xl blur-xl scale-105 transition-all ${
                      cardState.isFrozen
                        ? "bg-zinc-800/20"
                        : "bg-gradient-to-r from-zinc-300/20 to-zinc-400/20 dark:from-zinc-800/20 dark:to-zinc-900/20"
                    }`}
                  />
                  <div
                    className="relative rounded-2xl overflow-hidden border border-white/10 shadow-xl"
                    style={{
                      background: cardState.isFrozen
                        ? "linear-gradient(135deg, #09090b 0%, #18181b 100%)"
                        : "linear-gradient(135deg, #18181b 0%, #27272a 50%, #09090b 100%)",
                      aspectRatio: "1.586/1",
                    }}
                  >
                    <div className="absolute inset-0 card-shimmer" />
                    {cardState.isFrozen && (
                      <div className="absolute inset-0 bg-zinc-950/40 flex items-center justify-center z-10">
                        <div className="text-center">
                          <SnowflakeIcon className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                          <p className="text-foreground font-semibold">Card Frozen</p>
                        </div>
                      </div>
                    )}
                    <div className="relative h-full p-5 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-zinc-950 dark:bg-zinc-50 flex items-center justify-center">
                            <Zap className="w-3 h-3 text-zinc-50 dark:text-zinc-950" />
                          </div>
                          <span className="font-bold text-white text-sm tracking-wider">DIGITAL PAYMENT SYSTEM</span>
                        </div>
                        <Badge
                          variant="secondary"
                          className="text-xs"
                        >
                          {cardState.mode === "credit" ? "Credit" : "Debit"}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <p className="text-white/80 font-mono text-sm tracking-[0.15em]">
                          {showDetails ? "4820 3961 7204 4291" : cardState.cardNumber}
                        </p>
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-white/40 text-xs uppercase tracking-wider mb-0.5">CVV</p>
                            <p className="text-white text-xs font-medium font-mono">
                              {showDetails ? "847" : cardState.cvv}
                            </p>
                          </div>
                          <div className="text-center">
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

                {/* Card actions */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDetails(!showDetails)}
                  >
                    {showDetails ? (
                      <><EyeOff className="w-4 h-4" /> Hide Details</>
                    ) : (
                      <><Eye className="w-4 h-4" /> Show Details</>
                    )}
                  </Button>
                  <Button
                    variant={cardState.isFrozen ? "default" : "outline"}
                    size="sm"
                    onClick={toggleFreeze}
                    disabled={saving}
                    className={cardState.isFrozen ? "bg-zinc-900 border-zinc-850 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-105 dark:text-zinc-900" : ""}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <SnowflakeIcon className="w-4 h-4" />
                    )}
                    {cardState.isFrozen ? "Unfreeze" : "Freeze"}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="col-span-2 mt-2"
                    asChild
                  >
                    <Link href="/qr-pay">
                      <Camera className="w-4 h-4 mr-2" />
                      QR Code Pay
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Card Settings */}
              <div className="space-y-4">
                {/* Mode toggle */}
                <Card className="border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Card Mode</CardTitle>
                    <CardDescription className="text-xs">
                      Switch between Credit and Debit mode
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => cardState.mode !== "credit" && toggleMode()}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          cardState.mode === "credit"
                            ? "border-foreground bg-secondary"
                            : "border-border bg-secondary/30 hover:bg-secondary/50"
                        }`}
                      >
                        <ShieldCheck className={`w-4 h-4 mb-2 ${cardState.mode === "credit" ? "text-foreground" : "text-muted-foreground"}`} />
                        <p className={`text-xs font-semibold ${cardState.mode === "credit" ? "text-foreground" : "text-muted-foreground"}`}>
                          Credit
                        </p>
                        <p className="text-xs text-muted-foreground">Borrow against crypto</p>
                      </button>
                      <button
                        onClick={() => cardState.mode !== "debit" && toggleMode()}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          cardState.mode === "debit"
                            ? "border-foreground bg-secondary"
                            : "border-border bg-secondary/30 hover:bg-secondary/50"
                        }`}
                      >
                        <CreditCard className={`w-4 h-4 mb-2 ${cardState.mode === "debit" ? "text-foreground" : "text-muted-foreground"}`} />
                        <p className={`text-xs font-semibold ${cardState.mode === "debit" ? "text-foreground" : "text-muted-foreground"}`}>
                          Debit
                        </p>
                        <p className="text-xs text-muted-foreground">Spend directly</p>
                      </button>
                    </div>
                  </CardContent>
                </Card>

                {/* Card features */}
                <Card className="border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Card Features</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { icon: Globe, label: "Online Payments", desc: "E-commerce & subscriptions", defaultChecked: true },
                      { icon: Store, label: "Contactless POS", desc: "Tap to pay at stores", defaultChecked: true },
                      { icon: Camera, label: "QR Payments", desc: "Scan to pay or receive", defaultChecked: true },
                      { icon: CreditCard, label: "ATM Withdrawals", desc: "Up to €2,000/mo free", defaultChecked: false },
                    ].map((feature) => {
                      const Icon = feature.icon;
                      return (
                        <div key={feature.label} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{feature.label}</p>
                              <p className="text-xs text-muted-foreground">{feature.desc}</p>
                            </div>
                          </div>
                          <Switch defaultChecked={feature.defaultChecked} />
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Security */}
                <Card className="border-border bg-secondary/20">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Card Security Active</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          256-bit encryption · Biometric lock · Real-time fraud alerts
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Limits Tab */}
          <TabsContent value="limits" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Card className="border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      Spending Limits
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Daily limit slider */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label>Daily Spending Limit</Label>
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(spendingLimit[0])}
                        </span>
                      </div>
                      <Slider
                        value={spendingLimit}
                        onValueChange={setSpendingLimit}
                        min={100}
                        max={5000}
                        step={50}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>$100</span>
                        <span>$5,000</span>
                      </div>
                    </div>

                    <Separator />

                    {/* Usage today */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Used Today</span>
                        <span>
                          {formatCurrency(cardState.currentDaySpend)} /{" "}
                          {formatCurrency(spendingLimit[0])}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-zinc-950 dark:bg-zinc-50 rounded-full transition-all"
                          style={{
                            width: `${Math.min((cardState.currentDaySpend / spendingLimit[0]) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(spendingLimit[0] - cardState.currentDaySpend)} remaining today
                      </p>
                    </div>

                    <Button
                      variant="default"
                      className="w-full"
                      onClick={saveSpendingLimit}
                      disabled={saving}
                    >
                      {saving ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                      ) : saveSuccess ? (
                        <><CheckCircle className="w-4 h-4" /> Saved!</>
                      ) : (
                        "Save Limits"
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Monthly stats */}
                <Card className="border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Monthly Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { label: "Total Spend", value: formatCurrency(cardState.monthlySpend), color: "text-foreground" },
                      { label: "Cashback Earned", value: `+${formatCurrency(cardState.monthlySpend * 0.02)}`, color: "text-foreground" },
                      { label: "ATM Withdrawals", value: "€0 / €2,000 free", color: "text-foreground" },
                      { label: "Transactions", value: "23 transactions", color: "text-foreground" },
                    ].map((item) => (
                      <div key={item.label} className="flex justify-between items-center py-1">
                        <span className="text-sm text-muted-foreground">{item.label}</span>
                        <span className={`text-sm font-medium ${item.color}`}>{item.value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Per-category limits */}
              <div>
                <Card className="border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Category Controls</CardTitle>
                    <CardDescription className="text-xs">
                      Enable or disable specific spend categories
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { category: "Groceries & Food", limit: "$500/mo", enabled: true },
                      { category: "Entertainment", limit: "$200/mo", enabled: true },
                      { category: "Travel", limit: "$1,000/mo", enabled: true },
                      { category: "Online Shopping", limit: "$300/mo", enabled: true },
                      { category: "Gambling", limit: "Blocked", enabled: false },
                      { category: "Adult Content", limit: "Blocked", enabled: false },
                    ].map((cat) => (
                      <div key={cat.category} className="flex items-center justify-between py-1">
                        <div>
                          <p className="text-sm font-medium">{cat.category}</p>
                          <p className="text-xs text-muted-foreground">{cat.limit}</p>
                        </div>
                        <Switch defaultChecked={cat.enabled} />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Warning about limits */}
                <Card className="mt-4 border-border bg-secondary/20">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        Spending limit changes take effect immediately. Your available
                        credit is still subject to your health factor and collateral value.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Top Up Tab */}
          <TabsContent value="topup">
            <div className="max-w-lg mx-auto">
              <DepositCollateral
                solPriceUsd={position.solPriceUsd}
                onDeposited={() => {
                  // Could trigger a refresh here if needed
                }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
}
