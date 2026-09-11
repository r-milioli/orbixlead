import path from "node:path";
import type { NextConfig } from "next";

const apiInternal = process.env.API_INTERNAL_URL || "http://localhost:4000";

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
};

export default nextConfig;
