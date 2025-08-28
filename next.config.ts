import type { NextConfig } from "next";
import webpack from "webpack";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {};

    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      encoding: false,
    };
    if (isServer) {
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.IgnorePlugin({ resourceRegExp: /^face-api\.js$/ }),
        new webpack.IgnorePlugin({ resourceRegExp: /^meyda$/ }),
        new webpack.IgnorePlugin({ resourceRegExp: /^node-fetch$/ })
      );

      if (!config.externals) config.externals = [];
    }

    return config;
  },
};

export default nextConfig;
