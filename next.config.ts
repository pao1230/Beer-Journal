import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Photos are resized in the browser to well under this before upload.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
