// GST Mission 2026 — Service Worker v2
// Handles: install, activate, push, notificationclick

const CACHE_NAME = 'gst-v2';
const ASSETS = ['./index.html', './manifest.json'];

// ── Install & Cache ──────────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => clients.claim())
    );
});

// ── Fetch (offline support) ──────────────────────────────────
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(r => r || fetch(event.request))
    );
});

// ── Push Received ────────────────────────────────────────────
self.addEventListener('push', event => {
    let data = { title: '⏱️ Study Sync', body: 'Time to check in, Rongon!', type: 'generic' };

    if (event.data) {
        try { data = { ...data, ...event.data.json() }; }
        catch { data.body = event.data.text(); }
    }

    const options = buildNotificationOptions(data);
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

function buildNotificationOptions(data) {
    const base = {
        icon: 'https://cdn-icons-png.flaticon.com/512/564/564619.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/564/564619.png',
        vibrate: [200, 100, 200, 100, 200],
        renotify: true,
        requireInteraction: false,
    };

    switch (data.type) {
        case 'study-check':
            return {
                ...base,
                body: data.body,
                tag: 'study-check',
                requireInteraction: true,
                actions: [
                    { action: 'yes',   title: '✅ Still studying' },
                    { action: 'break', title: '☕ Take a break'   }
                ],
                data: { type: 'study-check' }
            };

        case 'savage':
            return {
                ...base,
                body: data.body,
                tag: 'savage-mode',
                vibrate: [300, 100, 300, 100, 300, 100, 300],
                data: { type: 'savage' }
            };

        case 'break-over':
            return {
                ...base,
                body: data.body || '🔔 Break over! পড়ার টেবিলে ফেরো।',
                tag: 'break-over',
                requireInteraction: true,
                actions: [{ action: 'resume', title: '📚 Resume Study' }],
                data: { type: 'break-over' }
            };

        case 'morning':
            return {
                ...base,
                body: data.body || 'সকাল হয়েছে। পড়া বাকি রেখে ঘুমাচ্ছ কীভাবে?',
                tag: 'morning-call',
                requireInteraction: true,
                data: { type: 'morning' }
            };

        default:
            return { ...base, body: data.body, tag: 'study-notification' };
    }
}

// ── Notification Click ───────────────────────────────────────
self.addEventListener('notificationclick', event => {
    event.notification.close();
    const { action } = event;
    const { type } = event.notification.data || {};

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            const dashboardClient = clientList.find(c => c.url.includes('index.html') || c.url.endsWith('/'));

            const msg = action === 'yes'    ? 'cancelAutoStop'
                      : action === 'break'  ? 'startBreak'
                      : action === 'resume' ? 'resumeStudy'
                      : null;

            if (dashboardClient) {
                if (msg) dashboardClient.postMessage({ action: msg, type });
                return dashboardClient.focus();
            } else {
                // Open the dashboard if no window exists
                return clients.openWindow('./index.html').then(newClient => {
                    if (newClient && msg) {
                        // Wait for page to load before posting
                        setTimeout(() => newClient.postMessage({ action: msg, type }), 2000);
                    }
                });
            }
        })
    );
});