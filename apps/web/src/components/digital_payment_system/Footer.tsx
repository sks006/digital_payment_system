import Link from "next/link";
import { Zap, Shield, Globe, ExternalLink } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 mt-auto">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-zinc-950 dark:bg-zinc-50 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-zinc-50 dark:text-zinc-950" />
              </div>
              <span className="font-bold gradient-text">Digital Payment System</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Spend your crypto without selling it. Powered by Solana.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="#"
                className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </a>
              <a
                href="#"
                className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <Globe className="w-4 h-4 text-muted-foreground" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Product</p>
            <ul className="space-y-2">
              {[
                { href: "/dashboard", label: "Dashboard" },
                { href: "/card", label: "Digital Payment System Card" },
                { href: "/swap", label: "Swap" },
                { href: "/pos-simulator", label: "POS Simulator" },
              ].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Features */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Features</p>
            <ul className="space-y-2">
              {[
                "Credit Mode",
                "Debit Mode",
                "2% Cashback",
                "Daily Interest",
                "Jupiter Swaps",
                "Health Factor",
              ].map((item) => (
                <li key={item}>
                  <span className="text-sm text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Security */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Security</p>
            <div className="space-y-2">
              {[
                { icon: Shield, text: "Non-custodial" },
                { icon: Shield, text: "Anchor Smart Contracts" },
                { icon: Shield, text: "Real-time liquidation protection" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2">
                  <item.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <p>© 2026 Digital Payment System. Built on Solana.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-foreground transition-colors">Risk Disclosure</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
