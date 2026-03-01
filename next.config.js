/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/',
        destination: '/broadcast',
        permanent: true, // or false depending on whether you want a 301 or 302 redirect
      },
    ]
  },
}
