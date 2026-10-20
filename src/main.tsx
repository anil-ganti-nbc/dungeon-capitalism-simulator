import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { Capacitor } from '@capacitor/core';
import { prepareNativeApp } from './native/bridge';
import App from './App.tsx';
import './index.css';

// Native assets come from the APK; a stale service worker must not replace a packaged build.
if (!Capacitor.isNativePlatform()) registerSW({ immediate: true });
const root = createRoot(document.getElementById('root')!);
void prepareNativeApp().then(nativeNotice => root.render(<App nativeNotice={nativeNotice} />)).catch(() => {
  // Do not mount a fresh campaign over inaccessible/incompatible native checkpoint data.
  root.render(<main role="alert" className="p-6 text-slate-100 bg-slate-950 min-h-screen">
    <h1>Saved ledger could not be opened safely</h1>
    <p>No new campaign was started and native backup data was not erased. Close and reopen the app. Do not uninstall or clear app data; retain the backup for inspection.</p>
  </main>);
});
