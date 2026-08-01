// apps/web/src/lib/api-client.ts
//
// All backend calls go through Next.js API routes (the proxy) so:
//   - BACKEND_URL stays server-side
//   - No CORS issues in production
//   - Same code path in dev and prod
//
// The proxy lives at:
//   GET  /api/nfc/nonce  → backend /nfc/nonce
//   POST /api/nfc/tap    → backend /nfc/tap

// ----- nonce -----------------------------------------------------------------

export async function getNonce(): Promise<string> {
  const res = await fetch("/api/nfc/nonce", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to get nonce (HTTP ${res.status})`);
  const data = (await res.json()) as { nonce?: string };
  if (!data.nonce) throw new Error("Backend returned an empty nonce");
  return data.nonce;
}

// ----- tap -------------------------------------------------------------------

export interface NfcTapParams {
  walletAddress: string;
  amount: number; // in EURC micro-units (already multiplied by 1e6)
  deviceId: string;
  nonce: string;
  txSignature: string;
  estimatedHealthFactor?: number;
  merchantData?: {
    merchant?: string;
    amount?: string;
    currency?: string;
    invoice?: string;
  };
}

export interface NfcTapResponse {
  success: boolean;
  receiptId: string;
  amount: number;
  txHash: string;
  merchantName: string;
  message: string;
  newHealthFactor: number;
  timestamp: string;
}

export async function nfcTap(params: NfcTapParams): Promise<NfcTapResponse> {
  const res = await fetch("/api/nfc/tap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallet_address: params.walletAddress,
      amount: params.amount,
      device_id: params.deviceId,
      nonce: params.nonce,
      tx_signature: params.txSignature,
      estimated_health_factor: params.estimatedHealthFactor,
      merchant_data: params.merchantData,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message || `Tap failed (HTTP ${res.status})`,
    );
  }

  return (await res.json()) as NfcTapResponse;
}

export async function updateCardSettings(params: any): Promise<void> {
  console.log("Updating card settings:", params);
  // Mock implementation
  return new Promise((resolve) => setTimeout(resolve, 500));
}

export interface SwipeResponse {
  success: boolean;
  message: string;
  txHash?: string;
  transactionId: string;
  newBalance: number;
  approvedAmount: number;
  cashbackAmount: number;
}

export interface BalanceResponse {
  balance: number;
  availableCredit: number;
  currency: string;
}

export async function getBalance(walletAddress: string): Promise<BalanceResponse> {
  console.log("Getting balance for:", walletAddress);
  // Mock implementation
  return {
    balance: 1250.0,
    availableCredit: 8500.0,
    currency: "EURC",
  };
}

export async function swipeCard(params: any): Promise<SwipeResponse> {
  console.log("Swiping card:", params);
  // Mock implementation
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          success: true,
          message: "Card swiped successfully",
          txHash: "mock_hash",
          transactionId: "TX-" + Math.random().toString(36).substr(2, 9),
          newBalance: 1245.5,
          approvedAmount: params.amount || 0,
          cashbackAmount: (params.amount || 0) * 0.02,
        }),
      1000
    )
  );
}