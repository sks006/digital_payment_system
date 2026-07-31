"use client";

// =============================================================================
// QRScanner — opens the camera and decodes a Digital Payment System merchant QR
// =============================================================================
//
// Uses html5-qrcode for cross-browser camera access. Works in any modern
// browser including Phantom's in-app browser and Chrome Android.
//
// Returns the parsed merchant payload via onScanned callback.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { AlertCircle, Camera, X } from "lucide-react";
import type { MerchantQRPayload } from "@/components/digital_payment_system/MerchantQRDisplay";

interface Props {
  /** Called when a valid Digital Payment System QR has been scanned + parsed. */
  onScanned: (payload: MerchantQRPayload) => void;
  /** Called when the user closes the scanner. */
  onClose: () => void;
}

// Unique ID for the DOM node html5-qrcode will inject the camera feed into.
const SCANNER_DIV_ID = "digital-payment-system-qr-scanner";

export default function QRScanner({ onScanned, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  // Ref to the Html5Qrcode instance so we can stop it on unmount.
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // Latch — prevents double-firing onScanned if the camera sees the QR twice.
  const handledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const scanner = new Html5Qrcode(SCANNER_DIV_ID);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (vw, vh) => {
              const minDim = Math.min(vw, vh);
              const size = Math.floor(minDim * 0.75);
              return { width: size, height: size };
            },
          },
          (decodedText) => {
            if (handledRef.current) return;
            try {
              const parsed = JSON.parse(decodedText) as MerchantQRPayload;
              if (parsed.type !== "digital-payment-system-payment") {
                setError("Not a Digital Payment System payment QR");
                return;
              }
              if (!parsed.recipient || !parsed.amount || !parsed.merchant) {
                setError("Invalid QR payload");
                return;
              }
              const ageMs = Date.now() - parsed.ts;
              if (ageMs > 5 * 60 * 1000) {
                setError("QR has expired — ask merchant for a new one");
                return;
              }

              handledRef.current = true;
              
              // html5-qrcode states: 1=Idle, 2=Scanning, 3=Paused
              if (scanner.getState() === 2) {
                scanner.stop().catch(() => {});
              }
              
              onScanned(parsed);
            } catch (e) {
              setError("Couldn't parse QR — try again");
            }
          },
          () => {},
        );
        if (!cancelled) setStarting(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Could not open camera");
          setStarting(false);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      if (scanner) {
        if (scanner.getState() === 2) {
          scanner
            .stop()
            .then(() => {
              try { scanner.clear(); } catch(e) {}
            })
            .catch(() => {});
        } else {
          try { scanner.clear(); } catch(e) {}
        }
      }
    };
  }, [onScanned]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between p-4 text-white">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5" />
          <span className="text-sm font-semibold">Scan merchant QR</span>
        </div>
        <button onClick={onClose} className="p-2">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Camera feed area */}
      <div className="flex-1 relative">
        <div id={SCANNER_DIV_ID} className="w-full h-full" />
        {starting && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            Starting camera…
          </div>
        )}
        {error && (
          <div className="absolute inset-x-4 bottom-24 p-3 rounded-lg bg-red-500/20 border border-red-500/40 backdrop-blur">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
              <p className="text-xs text-red-100">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom helper text */}
      <div className="p-4 text-center text-white/80 text-sm">
        Point the camera at the merchant's QR code
      </div>
    </div>
  );
}