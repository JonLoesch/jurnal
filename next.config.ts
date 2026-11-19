import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page here depends on who is signed in, so we don't opt into cache components.
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
