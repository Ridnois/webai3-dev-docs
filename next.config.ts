import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx"],
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "contentlayer/generated": path.resolve("./.contentlayer/generated"),
    };
    return config;
  },
};

export default nextConfig;
