/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { appDir: true },
  // แนะนำ: เพิ่ม security headers/CSP ที่นี่
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
