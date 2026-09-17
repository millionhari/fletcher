import type { NextConfig } from "next";
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  transpilePackages: ["@fletcher/core", "@fletcher/db", "@fletcher/api"],
  serverExternalPackages: ["sharp", "postgres"],
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
  },
};

export default nextConfig;
