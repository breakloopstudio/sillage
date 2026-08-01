const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /(^|\\|\/)scripts[\\/]images[\\/]upscale[\\/]venv(\\|\/|$)/,
];

module.exports = config;
