"use client";

// =============================================================================
// DepositCollateral — UI component for SOL → vault deposit
// =============================================================================
//
// Two execution paths:
//
//   DESKTOP / IN-APP BROWSER:
//     1. User clicks "Deposit X SOL"
//     2. handleDeposit builds the tx, calls wallet.signAndSend
//     3. signAndSend returns the signature when confirmed
//     4. We show the success card
//
//   MOBILE CHROME (DEEP-LINK):
//     1. User clicks "Deposit X SOL"
//     2. handleDeposit builds the tx, calls wallet.signAndSend
//     3. signAndSend redirects to Phantom — page is unloaded
//     4. (User approves in Phantom)
//     5. Phantom redirects back to our page with signed tx in URL params
//     6. Page reloads. usePhantomMobile picks up the signed tx and stores it
//        in wallet.pendingSignedTx
//     7. Our useEffect detects pendingSignedTx, broadcasts via
//        connection.sendRawTransaction, waits for confirmation
//     8. We show the success card
//
// Critical: in the mobile path, the deposit handler stores the pending state
// in localStorage BEFORE the redirect, so on return we know there was a
// pending operation worth resuming.
//
// =============================================================================

import { useState, useEffect,useRef } from "react";
import bs58 from "bs58";

import { useEffectiveWallet } from "../../hooks/useEffectiveWallet";
import { useAnchorProvider } from "../../hooks/useAnchorProvider";
import {
  getLendingProgram,
  getVaultPda,
  getVaultTokenAccountPda,
  getUserPositionPda,
} from "../../lib/anchor-client";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
} from "@solana/spl-token";
import {
  Transaction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  ArrowDownLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";



// Quick-pick amounts for the UI.
const QUICK_AMOUNTS = [0.5, 1, 2, 5];

// Storage key for the in-flight deep-link deposit. Stored before redirecting
// to Phantom, consumed after returning. Helps us know "we have a pending
// deposit" so we know to broadcast the returned signed tx.
const PENDING_KEY = "digital_payment_system:pending_deposit";

interface Props {
  /** Live SOL/USD price for displaying USD-equivalent of the input. */
  solPriceUsd: number | null;
  /** Called after a successful deposit so the parent can refresh data. */
  onDeposited?: (signature: string) => void;
}

export default function DepositCollateral({
  solPriceUsd,
  onDeposited,
}: Props) {
  // Unified wallet — works for desktop, in-app browser, and deep-link.
  const wallet = useEffectiveWallet();
  const provider = useAnchorProvider();
  const broadcastingRef = useRef(false);

  // Local UI state.
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ signature: string } | null>(null);

  // Derived values for the preview line.
  const solAmount = parseFloat(amount) || 0;
  const usdPreview =
    solPriceUsd && solAmount > 0 ? solAmount * solPriceUsd : null;
  // 80% LTV — matches the on-chain ltv_threshold.
  const creditPreview = usdPreview !== null ? usdPreview * 0.8 : null;

  // ===========================================================================
  // Deep-link return: broadcast the signed tx
  // ===========================================================================
  //
  // After a deep-link sign, the page reloads with the signed tx in URL params.
  // usePhantomMobile picks it up and exposes it via wallet.pendingSignedTx.
  // We watch for that here and broadcast.
  //
  // ===========================================================================
useEffect(() => {
  // Guard against React strict-mode / re-render double execution.
  if (broadcastingRef.current) return;

  // Read directly — don't destructure into local vars at top of effect,
  // because the values you want are on the wallet object at execution time.
  if (!wallet.pendingSignedTx) return;
  if (!provider) return;

  // Snapshot the values we need INSIDE the effect run.
  const signedTxBase58 = wallet.pendingSignedTx;
  const pending = localStorage.getItem(PENDING_KEY);
  if (!pending) return;

  // Mark we're broadcasting, then clear from state.
  broadcastingRef.current = true;
  wallet.consumePendingSignedTx();

  (async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("[Deposit] broadcasting signed tx, length:", signedTxBase58.length);

      const signedTxBytes = bs58.decode(signedTxBase58);
      console.log("[Deposit] decoded tx bytes:", signedTxBytes.length);

      const signature = await provider.connection.sendRawTransaction(
        signedTxBytes,
        { skipPreflight: false, preflightCommitment: "confirmed" },
      );
      console.log("[Deposit] broadcast OK, signature:", signature);

      await provider.connection.confirmTransaction(signature, "confirmed");
      console.log("[Deposit] confirmed");

      setSuccess({ signature });
      setAmount("");
      localStorage.removeItem(PENDING_KEY);
      onDeposited?.(signature);
    } catch (e: any) {
      console.error("[Deposit] broadcast failed:", e);
      setError(e?.message ?? "Failed to broadcast signed transaction");
      localStorage.removeItem(PENDING_KEY);
    } finally {
      setLoading(false);
      broadcastingRef.current = false;
    }
  })();
  // We deliberately don't depend on `wallet` (object identity changes
  // every render). pendingSignedTx as a string is stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [wallet.pendingSignedTx, provider]);

  // ===========================================================================
  // Main deposit action — builds tx and submits
  // ===========================================================================
  const handleDeposit = async () => {
    // Pre-flight checks.
    if (!wallet.connected || !wallet.publicKey || !provider) {
      setError("Please connect your Solana wallet first");
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
      // ----- Build PDAs and ATAs ----------------------------------------------
      const program = getLendingProgram(provider);
      const vaultPda = getVaultPda();
      const vaultTokenAccount = getVaultTokenAccountPda();
      const userPositionPda = getUserPositionPda(wallet.publicKey);

      // wSOL ATA — the program expects deposits in wrapped SOL since SPL
      // token::transfer doesn't work with native SOL directly.
      const userWsolAta = await getAssociatedTokenAddress(
        NATIVE_MINT,
        wallet.publicKey,
        false,                         // allowOwnerOffCurve
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );

      // SOL → lamports (9 decimals).
      const lamports = Math.round(solAmount * 1e9);
      const tx = new Transaction();

      // ----- Step 1: create wSOL ATA if missing -------------------------------
      const ataInfo = await provider.connection.getAccountInfo(userWsolAta);
      if (!ataInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,          // payer
            userWsolAta,                // ata to create
            wallet.publicKey,           // owner of the ata
            NATIVE_MINT,                // mint (wSOL)
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID,
          ),
        );
      }

      // ----- Step 2: send native SOL to the wSOL ATA --------------------------
      // Just a regular SystemProgram.transfer — moves lamports from the user
      // to the wSOL ATA, but the SPL token program doesn't yet know about it.
      tx.add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: userWsolAta,
          lamports,
        }),
      );

      // ----- Step 3: sync native --------------------------------------------
      // Tells the SPL token program "the lamport balance changed, please
      // update your internal token amount". After this, getTokenAccountBalance
      // returns the correct wrapped-SOL amount.
      tx.add(createSyncNativeInstruction(userWsolAta));

      // ----- Step 4: deposit ix (Anchor program) ----------------------------
      const depositIx = await (program.methods as any)
        .deposit(new BN(lamports))
        .accounts({
          user: wallet.publicKey,
          vault: vaultPda,
          userPosition: userPositionPda,
          userTokenAccount: userWsolAta,
          vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          clock: SYSVAR_CLOCK_PUBKEY,
        } as any)
        .instruction();
      tx.add(depositIx);

      // ----- Mark pending if deep-link --------------------------------------
      // The page is about to unload (deep-link) — we need to remember on
      // return that we initiated this deposit. The amount is just for UX;
      // the signed tx in the URL is what we'll actually broadcast.
      if (wallet.isDeeplink) {
        localStorage.setItem(
          PENDING_KEY,
          JSON.stringify({ amount: solAmount }),
        );
      }

      // ----- Sign & send -----------------------------------------------------
      // Desktop path: signature comes back synchronously, we set success.
      // Deep-link path: this throws "Redirecting to Phantom" — we catch
      // that specifically so it doesn't surface as an error to the user.
      const signature = await wallet.signAndSend(tx);

      setSuccess({ signature });
      setAmount("");
      onDeposited?.(signature);
    } catch (e: any) {
      // Special case: deep-link redirect throws this on purpose. Swallow it.
      if (e?.message?.includes("Redirecting to Phantom")) return;
      console.error("Deposit failed:", e);
      setError(e?.message ?? "Transaction failed");
      // Clear the pending marker since we never actually got to Phantom.
      localStorage.removeItem(PENDING_KEY);
    } finally {
      setLoading(false);
    }
  };

  // ===========================================================================
  // Render
  // ===========================================================================
  return (
    <Card className="w-full max-w-sm mx-auto border border-border bg-card shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowDownLeft className="w-4 h-4 text-muted-foreground" />
          <span className="text-foreground uppercase tracking-wider text-xs font-bold">
            Deposit Collateral
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick-pick amount buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {QUICK_AMOUNTS.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setAmount(String(amt))}
              disabled={loading}
              className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                amount === String(amt)
                  ? "border-zinc-900 bg-zinc-100 text-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-50"
                  : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {amt}
            </button>
          ))}
        </div>

        {/* Free-form amount input */}
        <div className="space-y-2">
          <Label htmlFor="deposit-sol-amount" className="text-zinc-300">Amount</Label>
          <div className="relative">
            <Input
              id="deposit-sol-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={loading}
              className="pr-16 text-lg font-semibold"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-foreground">
              SOL
            </span>
          </div>
          {usdPreview !== null && creditPreview !== null && (
            <p className="text-xs text-zinc-400">
              ≈ ${usdPreview.toFixed(2)} USD · unlocks{" "}
              <span className="text-foreground font-semibold">
                ~${creditPreview.toFixed(2)}
              </span>{" "}
              credit
            </p>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 break-words">{error}</p>
          </div>
        )}

        {/* Success banner with explorer link */}
        {success && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary border border-border">
            <CheckCircle2 className="w-4 h-4 text-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Deposit confirmed
              </p>
              <a
                href={`https://explorer.solana.com/tx/${success.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground underline inline-flex items-center gap-1 mt-1"
              >
                <ExternalLink className="w-3 h-3" />
                View on Solana Explorer
              </a>
            </div>
          </div>
        )}

        {/* Submit button */}
        <Button
          onClick={handleDeposit}
          disabled={loading || !solAmount || !wallet.connected}
          className="w-full h-12 text-base font-semibold bg-zinc-950 hover:bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:hover:bg-zinc-200 dark:text-zinc-900 shadow-md disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              {/* Different label for deep-link to set the right expectation. */}
              {wallet.isDeeplink
                ? wallet.pendingSignedTx
                  ? "Broadcasting on Solana…"
                  : "Redirecting to Phantom…"
                : "Confirming on Solana…"}
            </>
          ) : !wallet.connected ? (
            "Connect wallet to deposit"
          ) : solAmount > 0 ? (
            <>Deposit {solAmount} SOL</>
          ) : (
            "Deposit SOL"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}