/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Exclude native modules from webpack bundling
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // Ignore native modules that can't be bundled
    config.externals = config.externals || [];
    config.externals.push({
      'fsevents': 'commonjs fsevents',
    });
    
    // Ignore warnings about native modules
    config.ignoreWarnings = [
      { module: /fsevents/ },
      { file: /fsevents/ },
    ];
    
    return config;
  },
}

module.exports = nextConfig

