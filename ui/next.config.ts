import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-auth", "@convex-dev/better-auth", "@polar-sh/better-auth", "@polar-sh/sdk", "child_process", "googleapis"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
