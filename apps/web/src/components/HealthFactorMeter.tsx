"use client";

import { Shield, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CollateralPosition } from "@/lib/anchor-client";

interface HealthFactorMeterProps {
  position: CollateralPosition | null;
  healthFactor: number;
  riskLevel: "safe" | "moderate" | "warning" | "critical";
  riskColor: string;
  riskLabel: string;
  loading?: boolean;
}

function getProgressColor(riskLevel: string): string {
  switch (riskLevel) {
    case "safe": return "bg-zinc-900 dark:bg-zinc-100";
    case "moderate": return "bg-zinc-600 dark:bg-zinc-400";
    case "warning": return "bg-zinc-400 dark:bg-zinc-500";
    case "critical": return "bg-zinc-300 dark:bg-zinc-700";
    default: return "bg-zinc-900 dark:bg-zinc-100";
  }
}

function getProgressValue(hf: number): number {
  // Map health factor to 0-100 progress (capped at 3.0 = 100%)
  return Math.min((hf / 3.0) * 100, 100);
}

export default function HealthFactorMeter({
  position,
  healthFactor,
  riskLevel,
  riskColor,
  riskLabel,
  loading,
}: HealthFactorMeterProps) {
  const progressValue = getProgressValue(healthFactor);
  const progressColor = getProgressColor(riskLevel);

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-5 bg-secondary rounded w-40" />
        </CardHeader>
        <CardContent>
          <div className="h-12 bg-secondary rounded mb-4" />
          <div className="h-2 bg-secondary rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            Health Factor
          </CardTitle>
          <Badge
            variant="secondary"
          >
            {riskLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Big number */}
        <div className="flex items-end gap-2">
          <span className={cn("text-5xl font-bold tabular-nums", riskColor)}>
            {healthFactor.toFixed(2)}
          </span>
          <span className="text-muted-foreground text-sm mb-2">/ 3.00 max</span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn("h-full rounded-full transition-all duration-700", progressColor)}
              style={{ width: `${progressValue}%` }}
            />
            {/* Liquidation threshold marker at ~33% (HF = 1.0) */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-zinc-400/50"
              style={{ left: `${(1.0 / 3.0) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Liquidation</span>
            <span>Safe Zone</span>
          </div>
        </div>

        {/* Position details */}
        {position && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Collateral</p>
              <p className="text-sm font-medium">
                ${position.collateralUsdValue.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                {position.collateralAmount.toFixed(4)} {position.collateralSymbol}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Borrowed</p>
              <p className="text-sm font-medium">
                ${position.borrowedAmount.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                LTV {(position.ltv * 100).toFixed(1)}%
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Available Credit</p>
              <p className="text-sm font-medium text-foreground">
                ${position.maxBorrowable.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Liq. Threshold</p>
              <p className="text-sm font-medium">
                {(position.liquidationThreshold * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        )}

        {/* Warning */}
        {riskLevel === "warning" || riskLevel === "critical" ? (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary border border-border">
            <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              {riskLevel === "critical"
                ? "Your position is near liquidation. Add collateral immediately."
                : "Your health factor is low. Consider adding more collateral."}
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary border border-border">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Position is healthy. Liquidation occurs when health factor falls below 1.0.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
