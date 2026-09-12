import path from "node:path";
import type { NextConfig } from "next";

const apiInternal = process.env.API_INTERNAL_URL || "http://localhost:4000";
const isProd = process.env.NODE_ENV === "production";

// SEC-05: Content-Security-Policy.
// - 'unsafe-inline' em style/script é necessário para Mantine e o bootstrap do Next.
// - 'unsafe-eval' apenas em desenvolvimento (React Refresh / HMR).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
  // Garante server.js em apps/web/.next/standalone/apps/web/server.js no monorepo.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@orbixlead/shared"],
  webpack: (config, { dev }) => {
    // Evita OOM do PackFileCacheStrategy no Windows em sessões longas de dev.
    if (dev) {
      config.cache = { type: "memory" };
    }
    return config;
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternal}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
