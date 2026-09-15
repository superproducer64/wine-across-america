const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// RN 0.79 (Expo SDK 53) turns on package.json "exports" resolution by
// default, which breaks @supabase/realtime-js -> ws -> Node's `stream`
// module (ws ships a server-oriented "exports" entry that Metro now
// follows instead of falling back to its browser-safe main field).
// Official fix from Expo: https://docs.expo.dev/versions/latest/config/metro/#packagejsonexports
// See also: https://github.com/supabase/supabase-js/issues/1400
config.resolver.unstable_enablePackageExports = false;

config.resolver.assetExts.push('cjs');

config.watchFolders = [__dirname];
config.resolver.blockList = [
  new RegExp(`${path.resolve(__dirname, '.local').replace(/\\/g, '\\\\')}.*`),
];

module.exports = config;
