"use client";

import { useEffect, useState } from 'react';

export default function InstallApp() {
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const displayMode = matchMedia('(display-mode: standalone)');
    const update = () => setInstalled(displayMode.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    const onInstalled = () => setInstalled(true);
    update();
    displayMode.addEventListener('change', update);
    window.addEventListener('appinstalled', onInstalled);
    if (window.isSecureContext && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(error => console.error('App setup failed:', error));
    }
    return () => {
      displayMode.removeEventListener('change', update);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;
  return <details className="rounded-xl border border-border bg-card p-5 mt-6 text-sm leading-relaxed [&_p]:mt-3">
    <summary className="cursor-pointer font-semibold py-2">Install Orwell Bridge on your phone</summary>
    <p><strong>iPhone / iPad:</strong> Open in Safari, tap Share, then Add to Home Screen. Choose Open as Web App if shown, then Add.</p>
    <p><strong>Android:</strong> Open in Chrome, tap the menu, then Install app or Add to Home screen.</p>
    <p>Open the new icon for quick access. An internet connection is needed for current bridge conditions.</p>
  </details>;
}
