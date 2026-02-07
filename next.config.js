const path = require('path');

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['ipfs.io', 'gateway.pinata.cloud'],
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = { 
      fs: false, 
      net: false, 
      tls: false,
      '@react-native-async-storage/async-storage': false,
    };
    config.externals.push('pino-pretty', 'encoding');
    
    // Fix dependency resolution for ox → abitype (npm hoisting issue)
    config.resolve.alias = {
      ...config.resolve.alias,
      'abitype': path.resolve(__dirname, 'node_modules/abitype'),
    };

    // Ignore React Native imports in browser
    if (!isServer) {
      config.resolve.alias['@react-native-async-storage/async-storage'] = false;
    }
    
    return config;
  },
};

module.exports = withPWA(nextConfig);
