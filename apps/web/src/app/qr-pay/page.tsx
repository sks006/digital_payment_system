// apps/web/src/app/qr-pay/page.tsx
//
// QR Code Pay page — QR-based merchant ↔ customer payment flow.
//
// Sender mode: customer scans the merchant's QR with the device camera.
//   1. Tap "Scan to Pay" → camera opens
//   2. QR decoded → stored as `pendingPayment` (NOT auto-executed)
//   3. Phishing-protection card shows merchant + amount + recipient address
//   4. User taps "Confirm & Pay" → borrow+transfer fires
//   5. Phantom signs → tx broadcasts → success card with explorer link
//
// Receiver mode: merchant generates a fresh QR with name + amount.
//   QR encodes JSON payload including: merchant, amount, recipient wallet,
//   invoice ID, timestamp. Customer's app validates and rejects stale QRs.

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";

import { useEffectiveWallet } from "@/hooks/useEffectiveWallet";
import { useAnchorProvider } from "@/hooks/useAnchorProvider";
import { useHealthFactor } from "@/hooks/useHealthFactor";
import { useSolPrice } from "@/hooks/useSolPrice";
import {
  getLendingProgram,
  getUserPositionPda,
  getVaultPda,
  getEurcMintPda,
} from "@/lib/anchor-client";
import { SOL_USD_PRICE_UPDATE, EUR_USD_PRICE_UPDATE } from "@/lib/pyth-feeds";

import Header from "@/components/digital_payment_system/Header";
import Footer from "@/components/digital_payment_system/Footer";
import DepositCollateral from "@/components/digital_payment_system/DepositCollateral";
import MerchantQRDisplay, {
  type MerchantQRPayload,
} from "@/components/digital_payment_system/MerchantQRDisplay";
import QRScanner from "@/components/digital_payment_system/QRScanner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import {
  Camera,
  Store,
  Wallet,
  Activity,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RotateCcw,
} from "lucide-react";

type PayState =
  | "idle"
  | "scanning"
  | "borrowing"
  | "logging"
  | "success"
  | "error";

interface Receipt {
  receiptId: string;
  amount: number;
  merchantName: string;
  timestamp: string;
  txHash: string;
  message: string;
}

const STATE_LABEL: Record<PayState, string> = {
  idle: "Ready to pay",
  scanning: "Open camera to scan…",
  borrowing: "Borrowing & transferring on Solana…",
  logging: "Confirming receipt…",
  success: "Payment confirmed",
  error: "Payment failed",
};

export default function QRPayPage() {
  const wallet = useEffectiveWallet();
  const provider = useAnchorProvider();

  // ---- live data ---------------------------------------------------------
  const {
    position,
    healthFactor,
    riskLabel,
    refresh: refreshPosition,
    solPriceUsd,
  } = useHealthFactor(wallet.publicKey?.toBase58());

  const { solUsd, eurUsd, publishTimeMs } = useSolPrice();

  // ---- ui state ----------------------------------------------------------
  const [mode, setMode] = useState<"sender" | "receiver">("sender");
  const [payState, setPayState] = useState<PayState>("idle");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  // QR flow state
  const broadcastingRef = useRef(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  // Staged after scan; user must confirm before signing. Anti-phishing.
  const [pendingPayment, setPendingPayment] = useState<MerchantQRPayload | null>(
    null,
  );

  // ---- derived limits ---------------------------------------------------
  const collateralUsd = position?.collateralUsdValue ?? 0;
  const availableCreditUsd = position?.maxBorrowable ?? 0;
  const availableCreditEur =
    eurUsd && eurUsd > 0 ? availableCreditUsd / eurUsd : availableCreditUsd;

  const tooLowHF = healthFactor < 1.2;
  const canPay = !!wallet.connected && payState === "idle" && !tooLowHF;

  // ---- borrow + transfer atomic transaction -----------------------------
  const borrowAndGetSignature = useCallback(
    async (
      eurcAmount: number,
      merchant: {
        merchant: string;
        amount: string;
        currency: string;
        recipient: string;
      },
    ): Promise<string> => {
      if (!wallet.publicKey || !provider) {
        throw new Error("Wallet is not connected");
      }
      if (!merchant.recipient) {
        throw new Error("Merchant payload missing recipient");
      }

      const recipientPubkey = new PublicKey(merchant.recipient);
      const eurcMint = getEurcMintPda();
      const program = getLendingProgram(provider);
      const vaultPda = getVaultPda();
      const userPositionPda = getUserPositionPda(wallet.publicKey);

      // Verify the EURC mint exists on this cluster
      const mintInfo = await provider.connection.getAccountInfo(eurcMint);
      if (!mintInfo) {
        throw new Error(
          `EURC mint ${eurcMint.toBase58()} not found on this cluster. ` +
            `Make sure you're on Devnet and the program is initialized.`,
        );
      }

      // Derive ATAs
      const userEurcAta = await getAssociatedTokenAddress(
        eurcMint,
        wallet.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      const recipientEurcAta = await getAssociatedTokenAddress(
        eurcMint,
        recipientPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      const amountMicro = new BN(Math.round(eurcAmount * 1e6));
      const tx = new Transaction();

      // Create recipient ATA if missing
      const recipientAtaInfo =
        await provider.connection.getAccountInfo(recipientEurcAta);
      if (!recipientAtaInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            recipientEurcAta,
            recipientPubkey,
            eurcMint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
        );
      }

      // Borrow ix
      const borrowIx = await (program.methods as any)
        .borrow(amountMicro)
        .accounts({
          user: wallet.publicKey,
          vault: vaultPda,
          userPosition: userPositionPda,
          eurcMint,
          userEurcAccount: userEurcAta,
          solPriceUpdate: SOL_USD_PRICE_UPDATE,
          eurPriceUpdate: EUR_USD_PRICE_UPDATE,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          clock: SYSVAR_CLOCK_PUBKEY,
        } as any)
        .instruction();
      tx.add(borrowIx);

      // Transfer EURC user → merchant
      tx.add(
        createTransferCheckedInstruction(
          userEurcAta,
          eurcMint,
          recipientEurcAta,
          wallet.publicKey,
          Math.round(eurcAmount * 1e6),
          6,
          [],
          TOKEN_PROGRAM_ID,
        ),
      );

      const signature = await wallet.signAndSend(tx);
      return signature;
    },
    [wallet, provider],
  );

  // ---- QR handlers ------------------------------------------------------
  const handleQRScanned = useCallback((payload: MerchantQRPayload) => {
    setScannerOpen(false);
    setError(null);
    setReceipt(null);
    setPendingPayment(payload);
  }, []);

  const handleConfirmPayment = useCallback(async () => {
    if (!pendingPayment) return;
    const payload = pendingPayment;
    setPendingPayment(null);

    const eurcAmount = parseFloat(payload.amount);
    if (!isFinite(eurcAmount) || eurcAmount <= 0) {
      setError("Invalid amount in QR");
      setPayState("error");
      return;
    }
    if (eurcAmount > availableCreditEur) {
      setError(
        `Amount €${eurcAmount.toFixed(2)} exceeds your available credit (€${availableCreditEur.toFixed(2)}).`,
      );
      setPayState("error");
      return;
    }
    if (tooLowHF) {
      setError("Health factor too low. Add more collateral before spending.");
      setPayState("error");
      return;
    }

    try {
      setPayState("borrowing");

      if (wallet.isDeeplink) {
        localStorage.setItem(
          "digital_payment_system:pending_pay",
          JSON.stringify({
            merchant: payload.merchant,
            amount: payload.amount,
            invoice: payload.invoice,
          }),
        );
      }

      const sig = await borrowAndGetSignature(eurcAmount, {
        merchant: payload.merchant,
        amount: payload.amount,
        currency: payload.currency,
        recipient: payload.recipient,
      });

      setReceipt({
        receiptId: payload.invoice,
        amount: eurcAmount,
        merchantName: payload.merchant,
        timestamp: new Date().toISOString(),
        txHash: sig,
        message: "Paid via QR scan",
      });
      setPayState("success");
      refreshPosition();
      localStorage.removeItem("digital_payment_system:pending_pay");
    } catch (e: any) {
      if (e?.message?.includes("Redirecting to Phantom")) return;
      setError(e?.message ?? "Payment failed");
      setPayState("error");
      localStorage.removeItem("digital_payment_system:pending_pay");
    }
  }, [
    pendingPayment,
    availableCreditEur,
    tooLowHF,
    borrowAndGetSignature,
    refreshPosition,
    wallet.isDeeplink,
  ]);

  const handleStartScan = useCallback(() => {
    setError(null);
    setReceipt(null);

    if (!wallet.connected) {
      setError("Connect your Solana wallet first.");
      setPayState("error");
      return;
    }
    if (tooLowHF) {
      setError("Health factor too low. Add more collateral before spending.");
      setPayState("error");
      return;
    }

    setScannerOpen(true);
  }, [wallet.connected, tooLowHF]);

  const handleReset = useCallback(() => {
    setPayState("idle");
    setError(null);
    setReceipt(null);
    setPendingPayment(null);
    setScannerOpen(false);
  }, []);

  const isProcessing = payState === "borrowing" || payState === "logging";

  const priceTimeAgo = useMemo(() => {
    if (!publishTimeMs) return null;
    const seconds = Math.max(
      0,
      Math.round((Date.now() - publishTimeMs) / 1000),
    );
    return `${seconds}s ago`;
  }, [publishTimeMs, solUsd]);

  useEffect(() => {
    console.log('[PayEffect] start');
    if (!wallet.pendingSignedTx) {
      broadcastingRef.current = false;
      return;
    }
    if (!provider) return;
    if (broadcastingRef.current) return;

    const pendingStr = localStorage.getItem("digital_payment_system:pending_pay");
    if (!pendingStr) return;

    broadcastingRef.current = true;

    const pending = JSON.parse(pendingStr) as {
      merchant: string;
      amount: string;
      invoice: string;
    };

    const signedTxBase58 = wallet.consumePendingSignedTx();
    if (!signedTxBase58) return;

    import("bs58").then(async (bs58Module) => {
      const bs58 = bs58Module.default;
      try {
        setPayState("borrowing");
        setError(null);

        const signedTxBytes = bs58.decode(signedTxBase58);
        const signature = await provider.connection.sendRawTransaction(
          signedTxBytes,
          { skipPreflight: true, preflightCommitment: "confirmed" },
        );
        await provider.connection.confirmTransaction(signature, "confirmed");

        setReceipt({
          receiptId: pending.invoice,
          amount: parseFloat(pending.amount),
          merchantName: pending.merchant,
          timestamp: new Date().toISOString(),
          txHash: signature,
          message: "Paid via QR scan + Phantom mobile",
        });
        setPayState("success");
        localStorage.removeItem("digital_payment_system:pending_pay");
        refreshPosition();
      } catch (e: any) {
        console.error("[Pay] broadcast failed:", e);
        setError(e?.message ?? "Failed to broadcast signed transaction");
        setPayState("error");
        localStorage.removeItem("digital_payment_system:pending_pay");
      }
    });
  }, [wallet.pendingSignedTx, provider]);

  return (
    <div
      className="min-h-screen flex flex-col bg-background"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <Header />

      {isProcessing && (
        <div
          className="sticky top-0 z-50 bg-secondary border-b border-border shadow-lg"
          role="status"
          aria-live="polite"
        >
          <div className="container mx-auto px-4 py-3 flex items-center justify-center gap-2 text-foreground">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span className="text-sm font-semibold tracking-wide truncate">
              {STATE_LABEL[payState]}
            </span>
          </div>
        </div>
      )}

      <main className="flex-1 container mx-auto px-3 sm:px-4 py-5 sm:py-12">
        {/* Hero */}
        <div className="text-center max-w-xl mx-auto mb-5 sm:mb-8">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-1 sm:mb-2">
            QR Code Pay
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground px-2">
            Spend crypto without selling — powered by Solana
          </p>
        </div>

        {/* Live Pyth strip */}
        <div className="max-w-xl mx-auto mb-5 sm:mb-8">
          <Card className="border border-border bg-secondary/30">
            <CardContent className="py-2.5 px-3 sm:py-3 sm:px-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3">
                <div className="flex items-center gap-2 text-[10px] sm:text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-muted-foreground opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground" />
                  </span>
                  <span>Live Pyth Oracle</span>
                  {priceTimeAgo && (
                    <span className="text-muted-foreground normal-case font-normal ml-auto sm:ml-2">
                      · {priceTimeAgo}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 text-xs sm:text-sm">
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">SOL</span>
                    <span className="font-semibold tabular-nums">
                      {solUsd ? `$${solUsd.toFixed(2)}` : "—"}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">EUR</span>
                    <span className="font-semibold tabular-nums">
                      {eurUsd ? eurUsd.toFixed(4) : "—"}
                    </span>
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 mb-5 sm:mb-8 max-w-md mx-auto">
          <Button
            size="lg"
            variant={mode === "sender" ? "default" : "outline"}
            onClick={() => {
              handleReset();
              setMode("sender");
            }}
            className="flex-1 min-h-[48px] text-sm sm:text-base active:scale-[0.98] transition-transform"
          >
            <Wallet className="w-4 h-4 mr-2 shrink-0" />
            <span className="truncate">Sender</span>
          </Button>
          <Button
            size="lg"
            variant={mode === "receiver" ? "default" : "outline"}
            onClick={() => {
              handleReset();
              setMode("receiver");
            }}
            className="flex-1 min-h-[48px] text-sm sm:text-base active:scale-[0.98] transition-transform"
          >
            <Store className="w-4 h-4 mr-2 shrink-0" />
            <span className="truncate">Merchant</span>
          </Button>
        </div>

        {/* RECEIVER MODE */}
        {mode === "receiver" && (
          <div className="max-w-md mx-auto">
            <MerchantQRDisplay />
            <p className="text-center text-xs text-muted-foreground mt-5 sm:mt-6 max-w-sm mx-auto px-2 leading-relaxed">
              Show this QR to the customer. When they scan it from the Sender
              tab, their wallet will sign one transaction that mints EURC
              against their SOL collateral and transfers it to{" "}
              <span className="font-medium">this wallet</span> — all atomic,
              all on-chain.
            </p>
          </div>
        )}

        {/* SENDER MODE */}
        {mode === "sender" && (
          <div className="grid md:grid-cols-2 gap-5 sm:gap-6 max-w-4xl mx-auto">
            <div className="space-y-5 sm:space-y-6 md:order-2">
              <Card className="border border-border bg-card shadow-lg">
                <CardContent className="pt-6 pb-6 sm:pt-8 sm:pb-8 px-4 sm:px-6 text-center">
                  <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-secondary border border-border flex items-center justify-center mb-3 sm:mb-4">
                    {isProcessing ? (
                      <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-foreground animate-spin" />
                    ) : payState === "success" ? (
                      <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-foreground" />
                    ) : payState === "error" ? (
                      <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
                    ) : (
                      <Camera className="w-8 h-8 sm:w-10 sm:h-10 text-foreground" />
                    )}
                  </div>

                  <p className="text-xs sm:text-sm font-semibold tracking-wide uppercase text-foreground mb-1">
                    {STATE_LABEL[payState]}
                  </p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mb-5 sm:mb-6 px-2">
                    Open camera, scan the merchant&apos;s QR code, confirm
                  </p>

                  {payState === "idle" && (
                    <Button
                      onClick={handleStartScan}
                      disabled={!canPay}
                      className="w-full h-14 text-base font-semibold shadow-xl disabled:opacity-50 active:scale-[0.98] transition-transform touch-manipulation"
                    >
                      <Camera className="mr-2 w-5 h-5" />
                      Scan to Pay
                    </Button>
                  )}

                  {(payState === "success" || payState === "error") && (
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="w-full h-12 active:scale-[0.98] transition-transform touch-manipulation"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      New Payment
                    </Button>
                  )}

                  {receipt && payState === "success" && (
                    <div className="mt-5 text-left bg-secondary rounded-lg border border-border p-3 sm:p-4 space-y-2">
                      <div className="flex justify-between text-xs sm:text-sm gap-2">
                        <span className="text-muted-foreground shrink-0">
                          Merchant
                        </span>
                        <span className="font-medium text-foreground truncate">
                          {receipt.merchantName}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-zinc-400">Amount</span>
                        <span className="font-medium text-foreground">
                          €{receipt.amount.toFixed(2)} EURC
                        </span>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm gap-2">
                        <span className="text-zinc-400 shrink-0">
                          Invoice
                        </span>
                        <span className="font-mono text-[10px] sm:text-xs text-zinc-300 truncate">
                          {receipt.receiptId}
                        </span>
                      </div>
                      <a
                        href={`https://explorer.solana.com/tx/${receipt.txHash}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 mt-3 min-h-[44px] text-xs sm:text-sm text-muted-foreground hover:text-foreground font-medium border border-border rounded-lg bg-secondary active:scale-[0.98] transition-transform touch-manipulation underline"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View on Solana Explorer
                      </a>
                    </div>
                  )}

                  {payState === "error" && error && (
                    <p className="mt-4 text-xs text-muted-foreground bg-secondary border border-border rounded-lg p-3 text-left break-words">
                      {error}
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground px-2 text-center">
                <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>Non-custodial · Wallet-signed · Pyth-secured</span>
              </div>
            </div>

            <div className="space-y-5 sm:space-y-6 md:order-1">
              <DepositCollateral
                solPriceUsd={solPriceUsd}
                onDeposited={() => refreshPosition()}
              />

              <Card className="border border-border bg-secondary/10">
                <CardContent className="pt-5 sm:pt-6 px-4 sm:px-6 space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Your Position
                    </h3>
                    {wallet.publicKey && (
                      <Badge variant="secondary" className="text-[10px]">
                        <Activity className="w-3 h-3 mr-1" />
                        live
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        Collateral
                      </p>
                      <p className="text-xl sm:text-2xl font-bold tabular-nums">
                        ${collateralUsd.toFixed(2)}
                      </p>
                      {position && (
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {position.collateralAmount.toFixed(4)} SOL
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        Health Factor
                      </p>
                      <p className="text-xl sm:text-2xl font-bold tabular-nums text-foreground">
                        {healthFactor >= 9999 ? "∞" : healthFactor.toFixed(2)}
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        {riskLabel}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/60">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-muted-foreground">
                        Available credit
                      </span>
                      <span className="font-semibold text-foreground tabular-nums">
                        €{availableCreditEur.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Demo tip */}
        <div className="max-w-2xl mx-auto mt-8 sm:mt-12">
          <Card className="border border-border bg-secondary/30">
            <CardContent className="py-3 px-4 sm:py-4 sm:px-5">
              <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">
                  Investor demo tip:
                </span>{" "}
                On the merchant phone, switch to{" "}
                <span className="font-medium">Merchant</span> mode and connect
                that phone&apos;s wallet — that&apos;s where EURC will land.
                Generate a payment QR, then on the customer phone (in{" "}
                <span className="font-medium">Sender</span> mode) tap{" "}
                &ldquo;Scan to Pay&rdquo; and scan it. The customer&apos;s
                wallet signs ONE transaction with three instructions: borrow,
                transfer, and (if needed) ATA-create. All atomic, all on-chain.
                Get DevNet SOL from{" "}
                <Link
                  href="https://faucet.solana.com"
                  className="underline text-muted-foreground hover:text-foreground"
                  target="_blank"
                >
                  faucet.solana.com
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      {scannerOpen && (
        <QRScanner
          onScanned={handleQRScanned}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {pendingPayment && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur flex items-center justify-center p-4">
          <Card className="w-full max-w-sm border border-border bg-background shadow-2xl">
            <CardContent className="p-5 space-y-4">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center mb-2">
                  <ShieldCheck className="w-6 h-6 text-foreground" />
                </div>
                <h3 className="text-base font-bold text-foreground">Verify Payment</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Confirm the details below before signing
                </p>
              </div>

              <div className="space-y-2 bg-secondary/40 rounded-lg p-3 border border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Merchant</span>
                  <span className="font-semibold text-foreground">
                    {pendingPayment.merchant}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold text-foreground">
                    €{pendingPayment.amount} EURC
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">To wallet</span>
                  <span className="font-mono text-muted-foreground">
                    {pendingPayment.recipient.slice(0, 4)}…
                    {pendingPayment.recipient.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {pendingPayment.invoice}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary border border-border">
                <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Only confirm if you recognize this merchant. Anyone can make
                  a QR — check the wallet address before paying.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPendingPayment(null)}
                  className="flex-1 h-11"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmPayment}
                  className="flex-1 h-11"
                >
                  Confirm &amp; Pay
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Footer />
    </div>
  );
}
