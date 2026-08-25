import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.apmc.onionreport',
  appName: 'Onion Market Report',
  webDir: 'dist',
  android: {
    // The backend is reached over plain http during local testing; flip this off
    // once the server is behind https.
    allowMixedContent: true
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;
