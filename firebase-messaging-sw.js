// Firebase Cloud Messaging Service Worker
// File ini WAJIB berada di root /www/ agar bisa intercept semua URL di domain ini
// Ini memungkinkan push notification saat app tertutup sekalipun

importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Konfigurasi Firebase (sama dengan firebase-config.js)
firebase.initializeApp({
    apiKey: "AIzaSyCfZ9zV6DOuSZoFoFvkW8NCSaxNlmn8R8k",
    authDomain: "reuniakbar.firebaseapp.com",
    projectId: "reuniakbar",
    storageBucket: "reuniakbar.firebasestorage.app",
    messagingSenderId: "542951643652",
    appId: "1:542951643652:web:1b4b7dac6c676a5d6c3351"
});

const messaging = firebase.messaging();

// ── Background Message Handler ────────────────────────────────────────────────
// Dipanggil ketika push notification diterima saat TAB/APP TERTUTUP atau di background
messaging.onBackgroundMessage((payload) => {
    console.log('[FCM SW] Background message received:', payload);

    const notificationTitle = payload.notification?.title || '🔔 Notifikasi Baru';
    const notificationOptions = {
        body: payload.notification?.body || 'Ada aktivitas baru di Portal Panitia Reuni AL-FATAH',
        icon: '/img/logo.png',
        badge: '/img/logo.png',
        tag: 'reuni-notif-' + Date.now(),
        requireInteraction: true, // Notif tidak otomatis hilang
        data: payload.data || {},
        actions: [
            {
                action: 'open',
                title: '📱 Buka Aplikasi'
            },
            {
                action: 'dismiss',
                title: 'Tutup'
            }
        ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// ── Notification Click Handler ────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'dismiss') return;

    // Buka atau fokus ke tab aplikasi
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Jika tab sudah terbuka, fokus ke sana
                for (const client of clientList) {
                    if (client.url.includes('/index.html') || client.url.endsWith('/')) {
                        client.focus();
                        return;
                    }
                }
                // Jika tidak ada tab yang terbuka, buka baru
                return clients.openWindow('/index.html');
            })
    );
});

console.log('[FCM SW] Service Worker loaded for Portal Reuni AL-FATAH');
