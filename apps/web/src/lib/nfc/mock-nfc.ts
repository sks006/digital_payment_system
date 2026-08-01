// apps/web/src/lib/nfc/mock-nfc.ts
// Mock NFC for demo when real Web NFC is not available (desktop, iOS, etc.)

export const mockNFC = {
  /**
   * Simulate a physical NFC tap with realistic delay
   * @param delayMs How long to wait before "tapping" (default 1200ms)
   */
  async simulateTap(delayMs: number = 1200) {
    console.log("🔥 Mock NFC: Simulating physical tap...");

    // Wait to feel realistic (like real NFC scan)
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    return {
      serialNumber: `mock-device-${Date.now().toString(36)}`,
      nonce: `frontend-nonce-${Date.now()}`,
    };
  },
};