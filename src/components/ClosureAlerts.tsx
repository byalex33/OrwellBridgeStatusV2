"use client";

import { useEffect, useState } from 'react';

export default function ClosureAlerts() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('Checking notification support…');

  useEffect(() => {
    let active = true;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const installed = matchMedia('(display-mode: standalone)').matches || !!(navigator as Navigator & { standalone?: boolean }).standalone;
    if (ios && !installed) {
      setMessage('On iPhone or iPad, open this site in Safari, tap Share, then Add to Home Screen. Open the new icon to enable closure alerts.');
      setBusy(false);
      return;
    }
    if (!window.isSecureContext || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setMessage('This browser does not support closure alerts. Try an installed app in Safari on iPhone, or Chrome on Android.');
      setBusy(false);
      return;
    }
    void Promise.all([
      fetch('/api/push/key', { cache: 'no-store' }).then(async response => {
        if (!response.ok) throw new Error();
        return response.json();
      }).catch(() => ({ enabled: false, publicKey: null })),
      navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(registration => registration.pushManager.getSubscription()),
    ]).then(([config, existing]) => {
      if (!active) return;
      setSubscription(existing);
      setPublicKey(config.enabled && typeof config.publicKey === 'string' && config.publicKey ? config.publicKey : null);
      setMessage(Notification.permission === 'denied' ? 'Notifications are blocked. Allow them in your browser or phone settings, then reload this page.' : config.enabled && config.publicKey ? '' : 'Closure alerts are not available yet.');
    }).catch(() => {
      if (active) setMessage('Could not check closure alerts. Reload the page to try again.');
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function toggle() {
    setBusy(true);
    setMessage('');
    try {
      if (subscription) {
        const response = await fetch('/api/push/subscriptions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription.toJSON()) });
        if (!response.ok) throw new Error('Could not turn off alerts. Please try again.');
        await subscription.unsubscribe();
        setSubscription(null);
        setMessage('Closure alerts are off on this device.');
        return;
      }
      // Keep the permission prompt directly inside the user's click, before other async work.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage(permission === 'denied' ? 'Notifications are blocked. Allow them in your browser or phone settings, then reload this page.' : 'Notifications were not enabled.');
        return;
      }
      if (!publicKey) throw new Error('Closure alerts are not available yet.');
      const encoded = publicKey.replace(/-/g, '+').replace(/_/g, '/');
      const key = Uint8Array.from(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')), character => character.charCodeAt(0));
      const registration = await navigator.serviceWorker.ready;
      const created = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      try {
        const response = await fetch('/api/push/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...created.toJSON(), analyticsConsent: navigator.doNotTrack !== '1' && navigator.doNotTrack !== 'yes' }) });
        if (!response.ok) throw new Error();
      } catch {
        await created.unsubscribe();
        throw new Error('Could not save closure alerts. Please try again.');
      }
      setSubscription(created);
      setMessage('Closure alerts are on for this device.');
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : 'Could not update closure alerts. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="rounded-xl border border-border bg-card p-5 text-sm" aria-labelledby="closure-alerts-title">
    <h2 id="closure-alerts-title" className="font-semibold">Closure alerts</h2>
    <p className="mt-2 text-muted-foreground">Get a notification when a new bridge closure is detected. Alerts may arrive late or be missed; check current conditions before travelling.</p>
    {(publicKey || subscription) && <button type="button" disabled={busy} onClick={() => void toggle()} className="mt-3 rounded-lg bg-primary text-primary-foreground px-4 py-2 font-medium disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{busy ? 'Updating…' : subscription ? 'Turn off closure alerts' : 'Enable closure alerts'}</button>}
    <p role="status" aria-live="polite" className="mt-2 text-muted-foreground">{message || (subscription ? 'Closure alerts are on for this device.' : '')}</p>
  </section>;
}
