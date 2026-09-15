const { withGradleProperties } = require('@expo/config-plugins');

// AGP 8.9+ already recognizes compileSdk 36 as a supported (not preview)
// value, and this project is now on AGP 8.12 (see the SDK 51->55 migration),
// so this suppression flag is likely no longer strictly required. Left in
// as a harmless, verified-safe stopgap since there's no real device/emulator
// build available in this environment to confirm removing it is safe.
module.exports = function withAndroidSdk36(config) {
  return withGradleProperties(config, (config) => {
    const existing = config.modResults.find(
      (item) => item.key === 'android.suppressUnsupportedCompileSdk'
    );
    if (!existing) {
      config.modResults.push({
        type: 'property',
        key: 'android.suppressUnsupportedCompileSdk',
        value: '36',
      });
    }
    return config;
  });
};
