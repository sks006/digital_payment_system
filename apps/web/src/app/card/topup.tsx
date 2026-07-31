"use client";

import { useState } from "react";
import {
  ArrowDownLeft, Loader2, CheckCircle, Info, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAnchorProvider } from "@/hooks/useAnchorProvider";

import {
  NATIVE_MINT,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
} from "@solana/spl-token";
import { Transaction, SystemProgram } from "@solana/web3.js";
import { formatCurrency, formatSol } from "@/lib/utils";

const QUICK_AMOUNTS = [0.1, 0.5, 1, 2];

interface TopupProps {
  walletAddress: string;
  currentCollateralUsd: number;
  availableCredit: number;
  onSuccess?: (newCredit: number) => void;
}

export default function Topup({
  walletAddress,
  currentCollateralUsd,
  availableCredit,
  onSuccess,
}: TopupProps) {
  const { publicKey, signTransaction } = useWallet();
  const provider = useAnchorProvider();

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ txHash: string; newCredit: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const solAmount = parseFloat(amount) || 0;
  const SOL_PRICE_USD = 168.45; // approximate
  const usdValue = solAmount * SOL_PRICE_USD;
  const newCreditline = availableCredit + usdValue * 0.8;

  const handleDeposit = async () => {
    if (!publicKey || !signTransaction || !provider) {
      setError("Wallet not connected");
      return;
    }

    if (!solAmount || solAmount <= 0) {
      setError("Enter a valid SOL amount");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
   

      // 2. Prepend wrap instructions if user doesn't have wSOL
      const wSolAta = await getAssociatedTokenAddress(
        NATIVE_MINT,
        publicKey,
        false
      );

      const accountInfo = await provider.connection.getAccountInfo(wSolAta);
      const tx = new Transaction();

      if (!accountInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            wSolAta,
            publicKey,
            NATIVE_MINT
          )
        );
      }

      // Transfer SOL to wSOL ATA
      tx.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: wSolAta,
          lamports: solAmount * 1e9,
        })
      );

      // Sync native (wraps the SOL)
      tx.add(createSyncNativeInstruction(wSolAta));

      // Add the actual deposit instruction
    

      // 3. Get latest blockhash
      const { blockhash } = await provider.connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      // 4. Sign and send
      const signed = await signTransaction(tx);
      const signature = await provider.connection.sendRawTransaction(
        signed.serialize(),
        { skipPreflight: false }
      );
      await provider.connection.confirmTransaction(signature, "confirmed");

      // 5. Update UI
      const newCredit = availableCredit + usdValue * 0.8;
      setSuccess({ txHash: signature, newCredit });
      onSuccess?.(newCredit);
      setAmount("");
    } catch (e: any) {
      console.error("Deposit failed:", e);
      setError(e.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowDownLeft className="w-4 h-4 text-foreground" />
          Deposit SOL Collateral (Real)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* current state display */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-secondary/50">
            <p className="text-xs text-muted-foreground mb-1">Current Collateral</p>
            <p className="font-semibold">{formatCurrency(currentCollateralUsd)}</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary border border-border">
            <p className="text-xs text-muted-foreground mb-1">Available Credit</p>
            <p className="font-semibold text-foreground">{formatCurrency(availableCredit)}</p>
          </div>
        </div>

        {/* quick amounts */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">Quick Amount (SOL)</Label>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_AMOUNTS.map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(String(amt))}
                className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                  amount === String(amt)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {amt} SOL
              </button>
            ))}
          </div>
        </div>

        {/* custom amount */}
        <div className="space-y-2">
          <Label htmlFor="sol-amount">Custom Amount</Label>
          <div className="relative">
            <Input
              id="sol-amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pr-16"
              min="0"
              step="0.01"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
              SOL
            </span>
          </div>
          {solAmount > 0 && (
            <p className="text-xs text-muted-foreground">
              ≈ {formatCurrency(usdValue)} USD · New credit line:{" "}
              <span className="text-foreground font-semibold">{formatCurrency(newCreditline)}</span>
            </p>
          )}
        </div>

        {/* info */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/50 border border-border">
          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            SOL will be wrapped to wSOL and deposited into the lending vault.
            You'll receive ~80% LTV credit line.
          </p>
        </div>

        {error && (
          <p className="text-sm text-muted-foreground bg-secondary border border-border rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {success && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary border border-border">
            <CheckCircle className="w-4 h-4 text-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-foreground font-medium">Deposit successful!</p>
              <p className="text-xs text-muted-foreground mt-1">
                New available credit: {formatCurrency(success.newCredit)}
              </p>
              <a
                href={`https://solscan.io/tx/${success.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline mt-1"
              >
                <ExternalLink className="w-3 h-3" />
                View on Solscan
              </a>
            </div>
          </div>
        )}

        <Button
          variant="default"
          className="w-full"
          onClick={handleDeposit}
          disabled={loading || !solAmount}
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
          ) : (
            <><ArrowDownLeft className="w-4 h-4" /> Deposit {solAmount > 0 ? formatSol(solAmount) : "SOL"}</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}