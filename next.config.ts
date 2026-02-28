import type { NextConfig } from "next";
import nextra from "nextra";

const withNextra = nextra({
  contentDirBasePath: "/docs",
  search: {
    codeblocks: false,
  },
  defaultShowCopyCode: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath: "/fun-claw",
};

export default withNextra(nextConfig);
