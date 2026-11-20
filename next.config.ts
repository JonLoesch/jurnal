import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page here depends on who is signed in, so we don't opt into cache components.
  // Photos are shrunk in the browser; Vercel itself caps request bodies at 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
