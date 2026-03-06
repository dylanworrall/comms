import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  webpack: (config, { webpack }) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      streamdown: path.resolve("node_modules/streamdown/dist/index.js"),
    };
    config.plugins = config.plugins ?? [];
    config.plugins.push(
      new webpack.DefinePlugin({
        __VERSION__: JSON.stringify("2.3.0"),
      })
    );
    return config;
  },
};

export default nextConfig;
