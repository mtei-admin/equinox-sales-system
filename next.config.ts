import type { NextConfig } from "next";
import path from "path";

const lanOrigins = Array.from(
  new Set(
    ["localhost", "127.0.0.1", ...(process.env.ALLOWED_DEV_ORIGINS ?? "10.10.20.40").split(",")]
      .map((value) => value.trim())
      .filter(Boolean),
  ),
);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: lanOrigins,
  experimental: {
    serverActions: {
      allowedOrigins: [...lanOrigins.map((host) => `${host}:3002`), "localhost:3002"],
    },
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
