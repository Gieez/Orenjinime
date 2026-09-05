/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "*.scdn.co" },
      { protocol: "https", hostname: "*.spotifycdn.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "samehadaku.how" },
      { protocol: "https", hostname: "v2.samehadaku.how" },
      { protocol: "https", hostname: "*.samehadaku.how" },
    ],
    unoptimized: true,
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://i.scdn.co https://*.scdn.co https://*.spotifycdn.com https://i.ytimg.com https://lh3.googleusercontent.com https://v2.samehadaku.how https://*.samehadaku.how",
      "font-src 'self' data:",
      // Embed destinations — covers iframe redirects from /api/player/embed proxy
      "frame-src 'self' https://v2.samehadaku.how https://*.samehadaku.how https://wsrv.nl https://*.aniwave.to https://mavishub.com https://embedsito.com https://*.aniwatch.to https://megacloud.club https://*.megacloud.club https://vidcloud.pro https://*.vidcloud.pro https://sbplay.me https://embtaku.pro https://*.embtaku.pro https://plyhd.link https://*.plyhd.link https://metagets.net https://asianload.cc https://*.asianload.cc https://tenshi.id https://*.tenshi.id https://*.blogspot.com https://*.wibufile.com https://mega.nz https://*.mega.nz",
      "connect-src 'self' https://*.ingest.us.sentry.io https://*.sentry.io https://v2.samehadaku.how https://*.samehadaku.how",
      "worker-src 'self' blob:",
      "form-action 'self'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
