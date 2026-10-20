/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The API routes read the pre-built city guides from disk. Serverless hosts (Vercel) only ship
  // files a route is traced to import, so include the guides explicitly.
  outputFileTracingIncludes: {
    "/api/plan": ["./public/guides/**"],
    "/api/revise": ["./public/guides/**"],
  },
};

export default nextConfig;
