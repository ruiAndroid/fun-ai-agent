import type { NextConfig } from "next";

const basePath = process.env.NEXT_BASE_PATH ?? "/fun-agents";

const nextConfig: NextConfig = {
  basePath,
};

export default nextConfig;
