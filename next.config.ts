import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backend = (process.env.PHP_BACKEND_URL || "http://recorriendo.local").replace(/\/$/, "");
    return [...["register", "session", "login", "logout", "categories", "places", "location-search", "link-location"].map((route) => ({
      source: `/api/${route}`, destination: `${backend}/api/${route}.php`,
    })), { source: "/media/:file", destination: `${backend}/admin/storage/images/:file` }];
  },
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
