"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowDownUp,
  Loader2,
  Info,
  ChevronDown,
  CheckCircle,
  ExternalLink,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getMockQuote, getTokenList, type SwapQuote, type TokenInfo } from "@/lib/jupiter";
import { formatCurrency } from "@/lib/utils";

const MOCK_RATES: Record<string, number> = {
  SOL: 168.45,
  USDC: 1.0,
  USDT: 1.0,
  ETH: 3242.11,
  BTC: 68420.0,
};

interface TokenSelectProps {
  tokens: TokenInfo[];
  selected: string;
  onSelect: (symbol: string) => void;
}

function TokenSelect({ tokens, selected, onSelect }: TokenSelectProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/50 hover:bg-secondary transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
          {selected.slice(0, 1)}
        </div>
        <span className="font-medium text-sm">{selected}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 right-0 w-44 rounded-xl border border-border bg-card shadow-xl z-20 overflow-hidden">
            {tokens.map((t) => (
              <button
                key={t.symbol}
                onClick={() => { onSelect(t.symbol); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-secondary transition-colors text-left ${
                  selected === t.symbol ? "bg-secondary text-foreground" : "text-muted-foreground"
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
                  {t.symbol.slice(0, 1)}
                </div>
                <div>
                  <p className="font-medium text-foreground">{t.symbol}</p>
                  <p className="text-xs text-muted-foreground">{t.name}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function SwapSimulate() {
  const tokens = getTokenList();
  const [inputToken, setInputToken] = useState("SOL");
  const [outputToken, setOutputToken] = useState("USDC");
  const [inputAmount, setInputAmount] = useState("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [swapResult, setSwapResult] = useState<{ txHash: string } | null>(null);
  const [slippage, setSlippage] = useState(0.5);

  const fetchQuote = useCallback(async (amount: string, from: string, to: string) => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0 || from === to) {
      setQuote(null);
      return;
    }
    setQuoteLoading(true);
    setSwapResult(null);
    await new Promise((r) => setTimeout(r, 600));
    const q = getMockQuote(from, to, parsed);
    setQuote(q);
    setQuoteLoading(false);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchQuote(inputAmount, inputToken, outputToken);
    }, 500);
    return () => clearTimeout(timeout);
  }, [inputAmount, inputToken, outputToken, fetchQuote]);

  const flipTokens = () => {
    setInputToken(outputToken);
    setOutputToken(inputToken);
    setInputAmount("");
    setQuote(null);
  };

  const handleSwap = async () => {
    if (!quote) return;
    setSwapping(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSwapResult({
      txHash: `${Math.random().toString(36).slice(2, 8)}...${Math.random().toString(36).slice(2, 6)}`,
    });
    setSwapping(false);
    setQuote(null);
    setInputAmount("");
  };

  const inputUsd = (parseFloat(inputAmount) || 0) * (MOCK_RATES[inputToken] || 1);
  const outputUsd = quote ? quote.outAmount * (MOCK_RATES[outputToken] || 1) : 0;

  return (
    <Card className="border-border w-full max-w-md mx-auto">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-foreground" />
            Jupiter Swap Preview
          </span>
          <Badge variant="secondary" className="text-xs">Simulated</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input token */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-xs text-muted-foreground">You Pay</Label>
            {inputUsd > 0 && (
              <span className="text-xs text-muted-foreground">
                ≈ {formatCurrency(inputUsd)}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="0.00"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              className="flex-1 text-lg font-semibold"
              min="0"
              step="0.001"
            />
            <TokenSelect
              tokens={tokens}
              selected={inputToken}
              onSelect={(s) => { setInputToken(s); if (s === outputToken) setOutputToken(inputToken); }}
            />
          </div>
        </div>

        {/* Flip button */}
        <div className="flex justify-center">
          <button
            onClick={flipTokens}
            className="w-9 h-9 rounded-full border border-border bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-all hover:rotate-180 duration-300"
          >
            <ArrowDownUp className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Output token */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-xs text-muted-foreground">You Receive</Label>
            {outputUsd > 0 && (
              <span className="text-xs text-muted-foreground">
                ≈ {formatCurrency(outputUsd)}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center px-3 h-10 rounded-lg border border-border bg-secondary/30 text-lg font-semibold">
              {quoteLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <span className={quote ? "text-foreground" : "text-muted-foreground"}>
                  {quote ? quote.outAmount.toFixed(6) : "0.00"}
                </span>
              )}
            </div>
            <TokenSelect
              tokens={tokens}
              selected={outputToken}
              onSelect={(s) => { setOutputToken(s); if (s === inputToken) setInputToken(outputToken); }}
            />
          </div>
        </div>

        {/* Quote details */}
        {quote && !quoteLoading && (
          <div className="rounded-xl border border-border bg-secondary/30 p-3 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Rate</span>
              <span>
                1 {inputToken} = {(quote.outAmount / quote.inAmount).toFixed(6)} {outputToken}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Price Impact</span>
              <span className={quote.priceImpactPct > 1 ? "text-muted-foreground" : "text-foreground"}>
                {quote.priceImpactPct.toFixed(3)}%
                {quote.priceImpactPct > 1 && (
                  <AlertTriangle className="w-3 h-3 inline ml-1" />
                )}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Slippage Tolerance</span>
              <span>{slippage}%</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Min. Received</span>
              <span>{quote.otherAmountThreshold.toFixed(6)} {outputToken}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Route</span>
              <span className="text-muted-foreground">{quote.routePlan[0]?.swapInfo.label || "Direct"}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Network Fee</span>
              <span>~0.000005 SOL</span>
            </div>
          </div>
        )}

        {/* Slippage */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Slippage Tolerance</span>
          <div className="flex gap-1">
            {[0.1, 0.5, 1.0].map((s) => (
              <button
                key={s}
                onClick={() => setSlippage(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  slippage === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/50 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />
          <span>
            Quotes are provided by Jupiter DEX aggregator. This is a simulation — no real transactions will be executed.
          </span>
        </div>

        {/* Success */}
        {swapResult && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary border border-border">
            <CheckCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-foreground font-medium">Swap simulated!</p>
              <a
                href={`https://solscan.io/tx/${swapResult.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground mt-1 underline"
              >
                <ExternalLink className="w-3 h-3" />
                {swapResult.txHash}
              </a>
            </div>
          </div>
        )}

        <Button
          variant="default"
          className="w-full"
          onClick={handleSwap}
          disabled={!quote || swapping || quoteLoading}
        >
          {swapping ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Swapping...</>
          ) : (
            <>
              <ArrowDownUp className="w-4 h-4" />
              {quote ? `Swap ${inputAmount} ${inputToken} → ${outputToken}` : "Enter amount to swap"}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
