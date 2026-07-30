import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.GITHUB_ACTIONS ? "/bumper-rush" : "",
  assetPrefix: process.env.GITHUB_ACTIONS ? "/bumper-rush/" : undefined,
  images: { unoptimized: true },
};

export default nextConfig;
