import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // slim Docker image for Fly.io
  // let devices on the tailnet/LAN hit the dev server (phone testing)
  allowedDevOrigins: ["100.106.89.29", "localhost", "127.0.0.1"],
  experimental: {
    // library uploads post the part file + preview through a server action
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;
