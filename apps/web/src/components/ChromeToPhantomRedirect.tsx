"use client";

// =============================================================================
// ChromeToPhantomRedirect
// =============================================================================
//
// If the user opens our site in mobile Chrome (or any non-Phantom mobile
// browser), redirect them to open the same URL inside Phantom's built-in
// browser via the `phantom.app/ul/browse/<url>` universal link.
//
// Why: Phantom's in-app browser injects window.phantom.solana, so our wallet
// flow uses the standard (desktop-equivalent) signing path — no deep-link
// redirects, no signed-tx-in-URL handling. This is the reliable path.
//
// We only redirect once per session (sessionStorage flag) so the user can
// still escape back to Chrome if they want.
// =============================================================================

"use client";

import { useEffect } from "react";

const REDIRECTED_FLAG = "digital_payment_system:phantom_redirected";

export default function ChromeToPhantomRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Skip server-side, skip if already inside Phantom (provider injected).
    if ((window as any).phantom?.solana?.isPhantom) return;

    // Only mobile browsers — desktop uses the extension.
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) return;

    // Don't loop — once per session.
    if (sessionStorage.getItem(REDIRECTED_FLAG)) return;
    sessionStorage.setItem(REDIRECTED_FLAG, "1");

    // Build the universal link.
    // Format: https://phantom.app/ul/browse/<URL-ENCODED-DESTINATION>?ref=<REF>
    const destination = window.location.href;
    const ref = window.location.origin;
    const phantomBrowseUrl =
      `https://phantom.app/ul/browse/${encodeURIComponent(destination)}` +
      `?ref=${encodeURIComponent(ref)}`;

    // Replace current location so back button doesn't loop back to Chrome.
    window.location.href = phantomBrowseUrl;
  }, []);

  return null;
}