import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: isGitHubPages ? "/falhas_sp" : "",
  },
  images: {
    unoptimized: true,
  },
  ...(isGitHubPages
    ? {
        basePath: "/falhas_sp",
        assetPrefix: "/falhas_sp/",
      }
    : {}),
};

export default nextConfig;
