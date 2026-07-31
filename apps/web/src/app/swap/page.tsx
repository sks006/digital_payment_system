import Header from "@/components/digital_payment_system/Header";
import Footer from "@/components/digital_payment_system/Footer";
import SwapSimulate from "@/app/swap/simulate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, TrendingUp, Shield, RefreshCw } from "lucide-react";

const jupiterFeatures = [
  {
    icon: Zap,
    title: "Best Rates",
    description: "Routes through 30+ DEXes for optimal pricing",
    color: "text-foreground",
    bg: "bg-secondary",
  },
  {
    icon: TrendingUp,
    title: "Aggregated Liquidity",
    description: "Deep liquidity from Raydium, Orca, Phoenix & more",
    color: "text-foreground",
    bg: "bg-secondary",
  },
  {
    icon: Shield,
    title: "MEV Protection",
    description: "Protected against sandwich attacks and frontrunning",
    color: "text-foreground",
    bg: "bg-secondary",
  },
  {
    icon: RefreshCw,
    title: "Auto-Routing",
    description: "Split routes for maximum output on large trades",
    color: "text-foreground",
    bg: "bg-secondary",
  },
];

export default function SwapPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <Badge variant="secondary" className="mb-3">
            <Zap className="w-3.5 h-3.5 mr-1" />
            Powered by Jupiter v6
          </Badge>
          <h1 className="text-2xl font-bold">Token Swap</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Best-rate swaps across all Solana DEXes — simulated preview
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start max-w-4xl mx-auto">
          {/* Swap widget */}
          <SwapSimulate />

          {/* Jupiter features */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Why Jupiter?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {jupiterFeatures.map((f) => {
                const Icon = f.icon;
                return (
                  <Card key={f.title} className="border-border">
                    <CardContent className="p-4">
                      <div className={`w-8 h-8 rounded-lg ${f.bg} flex items-center justify-center mb-3`}>
                        <Icon className={`w-4 h-4 ${f.color}`} />
                      </div>
                      <p className="text-sm font-semibold mb-1">{f.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {f.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* How it integrates */}
            <Card className="border-border bg-secondary/20">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  Integrated with Digital Payment System Card
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  When you spend in Debit Mode, Digital Payment System automatically routes your
                  payment through Jupiter to convert your chosen token to the
                  merchant&apos;s currency at the best available rate — all in a
                  single transaction.
                </p>
              </CardContent>
            </Card>

            {/* Supported tokens */}
            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-sm font-semibold mb-3">Supported Tokens</p>
                <div className="flex flex-wrap gap-2">
                  {["SOL", "USDC", "USDT", "ETH", "BTC", "JUP", "BONK", "WIF", "RAY", "ORCA", "+ 400 more"].map(
                    (t) => (
                      <span
                        key={t}
                        className="px-2 py-1 rounded-md bg-secondary text-xs font-medium text-muted-foreground"
                      >
                        {t}
                      </span>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
