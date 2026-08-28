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
  },
  plugins: {
    /**
     * Over-the-air updates for the web layer.
     *
     * Everything in `dist/` — the React app, styles, copy — can be replaced on
     * an installed phone without shipping a new APK. Native changes (a new
     * Capacitor plugin, the launcher icon, permissions) still need a rebuild,
     * because none of that lives in the bundle.
     *
     * The update server is our own API, not Capgo Cloud: `updateUrl` receives a
     * POST describing the device's current bundle and answers with either the
     * next bundle to fetch or a plain "nothing new".
     */
    CapacitorUpdater: {
      autoUpdate: true,
      updateUrl: 'https://api.zeemotech.in/api/app/update',
      // A downloaded bundle is only kept if the app calls notifyAppReady()
      // within this window (see main.tsx). Miss it and the plugin rolls back to
      // the last good bundle, which is what stops a broken release from
      // bricking every installed phone.
      appReadyTimeout: 10000,
      autoDeleteFailed: true,
      autoDeletePrevious: true
    }
  }
};

export default config;
