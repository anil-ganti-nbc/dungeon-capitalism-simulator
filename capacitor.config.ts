import type { CapacitorConfig } from '@capacitor/cli';

// Stable Android identity/origin: changing these can strand existing WebView save data.
const config: CapacitorConfig = {
  appId: 'com.trapandtonic.game',
  appName: 'Trap & Tonic',
  webDir: 'dist',
  loggingBehavior: 'none',
  server: { hostname: 'localhost', androidScheme: 'https' },
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false }
};
export default config;
