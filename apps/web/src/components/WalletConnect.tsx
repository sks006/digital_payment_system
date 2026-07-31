"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet, LogOut, Copy, CheckCheck, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { shortenAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { usePhantomMobile } from "@/hooks/usePhantomMobile";

interface WalletConnectProps {
  className?: string;
}

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function WalletConnect({ className }: WalletConnectProps) {
  // Standard wallet adapter (desktop + Phantom in-app browser)
  const stdWallet = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();

  // Phantom mobile deep-link wallet (Chrome Android/iOS)
  const phantomMobile = usePhantomMobile();

  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Determine which wallet system is active (Safe for SSR)
  const useDeeplink = mounted && isMobile() && !(typeof window !== 'undefined' && (window as any).phantom?.solana?.isPhantom);
  const publicKey = useDeeplink ? phantomMobile.publicKey : stdWallet.publicKey;
  const connected = useDeeplink ? phantomMobile.connected : stdWallet.connected;

  useEffect(() => {
    if (connected && publicKey) {
      connection
        .getBalance(publicKey)
        .then((b) => setBalance(b / 1_000_000_000))
        .catch(() => setBalance(null));
    } else {
      setBalance(null);
    }
  }, [publicKey, connected, connection]);

  const handleConnect = () => {
    if (useDeeplink) {
      // Stay in Chrome — deep-link to Phantom for connect handshake.
      // Phantom returns to current URL with encrypted handshake params.
      const currentPath = window.location.pathname;
      phantomMobile.connect(currentPath);
    } else {
      setVisible(true);
    }
  };

  const handleDisconnect = () => {
    if (useDeeplink) phantomMobile.disconnect();
    else stdWallet.disconnect();
    setDropdownOpen(false);
  };

  const handleCopy = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!mounted) {
    return <div className={className} style={{ minWidth: "150px" }} />;
  }

  if (!connected) {
    return (
      <div className={className}>
        <Button
          variant="default"
          onClick={handleConnect}
          className="flex items-center gap-2"
        >
          <Wallet className="w-4 h-4" />
          Connect Wallet
        </Button>
      </div>
    );
  }

  // Dropdown UI — same as before
  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary/50 hover:bg-secondary transition-colors text-sm"
      >
        <div className="w-2 h-2 rounded-full bg-zinc-950 dark:bg-zinc-50 animate-pulse" />
        <span className="text-foreground font-mono">
          {shortenAddress(publicKey!.toBase58())}
        </span>
        {balance !== null && (
          <Badge variant="secondary" className="text-xs hidden sm:flex">
            {balance.toFixed(2)} SOL
          </Badge>
        )}
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            dropdownOpen && "rotate-180",
          )}
        />
      </button>

      {dropdownOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/5 z-20 overflow-hidden ring-1 ring-white/5">
            <div className="p-4 border-b border-border/50 bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Connected Wallet
              </p>
              <p className="font-mono text-sm text-foreground break-all bg-background/50 p-2 rounded-md border border-border/50 shadow-inner">
                {publicKey!.toBase58()}
              </p>
            </div>
            <div className="p-2 space-y-1">
              <button
                onClick={handleCopy}
                className="group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-transparent hover:bg-secondary/80 active:scale-[0.98] transition-all duration-200 text-sm font-medium text-muted-foreground hover:text-foreground ring-1 ring-transparent hover:ring-border/50"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-background shadow-sm border border-border/50 group-hover:border-border transition-colors">
                  {copied ? <CheckCheck className="w-4 h-4 text-foreground" /> : <Copy className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />}
                </div>
                {copied ? "Address Copied" : "Copy Address"}
              </button>
              <button
                onClick={handleDisconnect}
                className="group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-transparent hover:bg-red-500/10 active:scale-[0.98] transition-all duration-200 text-sm font-medium text-red-500 hover:text-red-600"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-red-500/10">
                  <LogOut className="w-4 h-4" />
                </div>
                Disconnect Wallet
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}