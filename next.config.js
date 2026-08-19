/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['got-scraping', 'header-generator', 'browserslist'],
  },
};

module.exports = nextConfig;