/** @type {import('next').NextConfig} */
const nextConfig = {
  // the booking page may be embedded on the Main Character website
  async headers() {
    return [{ source: '/:slug', headers: [{ key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://*.maincharacter.nl https://maincharacter.nl" }] }];
  },
};
export default nextConfig;
