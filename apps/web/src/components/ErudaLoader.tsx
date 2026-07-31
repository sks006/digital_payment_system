"use client";

import { useEffect } from "react";

export default function ErudaLoader() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return;
    
    import("eruda").then(({ default: eruda }) => eruda.init());
  }, []);

  return null;
}
