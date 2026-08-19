import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // @ts-ignore
  allowedDevOrigins: ['10.0.2.2', 'localhost'],
  images: {
    // Tự động tối ưu hoá ảnh sang định dạng WebP/AVIF
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'img.cloudx.com.vn',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'www.academy4heroes.com',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
      {
        protocol: 'https',
        hostname: '**',
      }
    ],
  },
  experimental: {
    // Bật tối ưu hoá bộ đệm (Caching) ở mức cao nhất
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/dashboard',
        permanent: true,
      },
      {
        source: '/reset-password',
        destination: '/auth/reset-password',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
