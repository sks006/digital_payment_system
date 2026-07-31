// apps/web/next.config.js
//
// CRITICAL for Web NFC:
//   The browser blocks NDEFReader.scan() / NDEFReader.write() unless the
//   page is served with a Permissions-Policy header that allows nfc.
//   Without this header, every NFC call rejects with NotAllowedError.

const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  turbopack: {
    root: path.join(__dirname, "../.."),
  },

  async headers() {
    return [
      {
        // Apply to every route on the site
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            // Allow NFC + USB + Bluetooth on same-origin (=self).
            // The wildcard syntax `nfc=*` is supported but `nfc=(self)` is
            // the safer choice — it grants the API to the top-level page
            // and refuses cross-origin iframes from using it.
            value:
              "nfc=(self), usb=(self), bluetooth=(self), camera=(self), microphone=()",
          },
          // Useful while you're behind localtunnel/ngrok during the demo
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;