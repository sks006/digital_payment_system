// apps/web/src/lib/nfc/web-nfc.ts

/**
 * Types for the Web NFC implementation
 */
export type NFCTapState =
  | "idle"
  | "scanning"
  | "reading"
  | "borrowing"
  | "logging"
  | "success"
  | "error";

export interface MerchantPayload {
  merchant: string;
  amount: string;
  currency: string;
  recipient?: string;
  invoice?: string;
}

export interface NFCReceipt {
  receiptId: string;
  amount: number;
  merchantName: string;
  timestamp: string;
  txHash: string;
  message: string;
}

export interface WebNFCOptions {
  amount: number;
  walletAddress: string;
  onStateChange: (state: NFCTapState) => void;
  onReceipt: (receipt: NFCReceipt) => void;
  onError: (message: string) => void;
  borrowAndGetSignature: (
    amount: number,
    payload: MerchantPayload,
  ) => Promise<string>;
}

/**
 * WebNFCManager handles the browser's NDEFReader API for both
 * scanning (customer side) and writing (merchant side).
 */
export class WebNFCManager {
  private abortController: AbortController | null = null;

  /**
   * Check if Web NFC (NDEFReader) is available in the current browser.
   */
  static isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "NDEFReader" in window &&
      (window as any).NDEFReader !== undefined
    );
  }

  /**
   * Start scanning for NFC tags. When a tag is detected, it parses the 
   * JSON payload and calls borrowAndGetSignature.
   */
  async startScan(options: WebNFCOptions) {
    if (!WebNFCManager.isSupported()) {
      options.onError("Web NFC is not supported on this device.");
      return;
    }

    this.stopScan(); // Ensure any previous scan is stopped
    this.abortController = new AbortController();

    try {
      const reader = new (window as any).NDEFReader();
      options.onStateChange("scanning");

      await reader.scan({ signal: this.abortController.signal });

      reader.addEventListener("reading", async ({ message }: any) => {
        try {
          options.onStateChange("reading");

          let payload: MerchantPayload | null = null;
          for (const record of message.records) {
            if (
              record.recordType === "mime" &&
              record.mediaType === "application/json"
            ) {
              const decoder = new TextDecoder();
              payload = JSON.parse(decoder.decode(record.data));
              break;
            }
          }

          if (!payload) {
            options.onError("Invalid tag: No merchant JSON data found.");
            options.onStateChange("error");
            return;
          }

          // Trigger the on-chain borrow and transfer
          options.onStateChange("borrowing");
          const signature = await options.borrowAndGetSignature(
            options.amount,
            payload,
          );

          // All good!
          options.onStateChange("logging");
          const receipt: NFCReceipt = {
            receiptId:
              payload.invoice || `RCPT-${Date.now().toString(36).toUpperCase()}`,
            amount: options.amount,
            merchantName: payload.merchant,
            timestamp: new Date().toISOString(),
            txHash: signature,
            message: "Payment confirmed on Solana",
          };

          options.onReceipt(receipt);
          options.onStateChange("success");
          this.stopScan();
        } catch (err: any) {
          console.error("NFC processing error:", err);
          options.onError(err.message || "Failed to process NFC tap");
          options.onStateChange("error");
        }
      });

      reader.addEventListener("readingerror", () => {
        options.onError("Hardware error reading NFC tag. Try again.");
        options.onStateChange("error");
      });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("NFC scan error:", err);
        options.onError(`NFC Scan failed: ${err.message}`);
        options.onStateChange("error");
      }
    }
  }

  /**
   * Stop any active NFC scan.
   */
  stopScan() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Write a merchant payment request to an NFC tag.
   */
  static async writeMerchantTag(payload: MerchantPayload) {
    if (!WebNFCManager.isSupported()) {
      throw new Error("Web NFC is not supported on this device.");
    }

    const reader = new (window as any).NDEFReader();
    const encoder = new TextEncoder();
    
    const message = {
      records: [
        {
          recordType: "mime",
          mediaType: "application/json",
          data: encoder.encode(JSON.stringify(payload)),
        },
      ],
    };

    await reader.write(message);
  }
}