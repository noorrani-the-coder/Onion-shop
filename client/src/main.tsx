import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/**
 * Tells the updater this bundle actually starts.
 *
 * This is the safety catch on over-the-air updates, and it only works if it is
 * reached *after* the app has really rendered: a bundle that fails to boot
 * never gets here, the plugin's appReadyTimeout expires, and the phone rolls
 * back to the last bundle that did. Skipping this call — or calling it at the
 * top of the file, before React has run — would mean a broken release sticks,
 * on every installed phone, with no way to push a fix except a new APK.
 */
if (Capacitor.isNativePlatform()) {
  // One frame after render, so a crash during the first paint still counts as
  // a failed boot rather than a successful one.
  requestAnimationFrame(() => {
    CapacitorUpdater.notifyAppReady().catch((err) => {
      console.error('Failed to notify updater that the app is ready:', err);
    });
  });
}
