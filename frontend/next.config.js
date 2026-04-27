/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow dev resource requests when app is opened through Docker/forwarded host IPs.
  allowedDevOrigins: ["172.28.112.1", "localhost", "127.0.0.1"],
};

module.exports = nextConfig;
