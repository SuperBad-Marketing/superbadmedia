import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/strategic-workshop",
        destination: "/workshop",
        permanent: true,
      },
      {
        source: "/strategic-workshop/:path*",
        destination: "/workshop/:path*",
        permanent: true,
      },
      {
        source: "/workshop",
        destination: "https://crm.superbadmedia.com.au/workshop",
        permanent: true,
      },
      {
        source: "/workshop/:path*",
        destination: "https://crm.superbadmedia.com.au/workshop/:path*",
        permanent: true,
      },
      {
        source: "/rundown",
        destination: "https://crm.superbadmedia.com.au/rundown",
        permanent: true,
      },
      {
        source: "/rundown/:path*",
        destination: "https://crm.superbadmedia.com.au/rundown/:path*",
        permanent: true,
      },
      {
        source: "/lite/:path*",
        destination: "https://crm.superbadmedia.com.au/lite/:path*",
        permanent: false,
      },
    ];
  },
  serverExternalPackages: [
    "better-sqlite3",
    "@sparticuz/chromium",
    "@remotion/renderer",
    "@remotion/bundler",
    "@remotion/compositor-darwin-arm64",
    "@remotion/compositor-darwin-x64",
    "@remotion/compositor-linux-arm64-gnu",
    "@remotion/compositor-linux-arm64-musl",
    "@remotion/compositor-linux-x64-gnu",
    "@remotion/compositor-linux-x64-musl",
  ],
  outputFileTracingIncludes: {
    "/*": ["./lib/db/migrations/**/*"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: false,
});
