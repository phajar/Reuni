// ==========================================
// FCM PUSH NOTIFICATION SYSTEM
// Firebase Cloud Messaging — Gratis (Spark Plan)
// ==========================================
// VAPID Key: Ganti string di bawah dengan VAPID Key dari
// Firebase Console → Project Settings → Cloud Messaging → Web Push Certificates
const FCM_VAPID_KEY = "BMjOxUbGSYrZwE3hfU-hw_DP6feMIZ89ROXYU61m810666obWoCScdX_NzQWbRwjYGJsiPMj83RpXXE8PP1V46U";

// Apakah platform native? (Capacitor Android/iOS)
const IS_NATIVE = typeof window.Capacitor !== "undefined" && window.Capacitor.isNativePlatform();

// Apakah browser mendukung FCM (atau jika native, apakah plugin FirebaseMessaging tersedia)?
const FCM_SUPPORTED = IS_NATIVE 
    ? (!!window.Capacitor.Plugins && !!window.Capacitor.Plugins.FirebaseMessaging)
    : (typeof firebase !== "undefined" && firebase.messaging && "Notification" in window && "serviceWorker" in navigator);

// ── Token Registration ────────────────────────────────────────────────────────
window.fcmMessaging = null;
window.fcmCurrentToken = null;
window.alumniUnsubscribe = null;
window.financeUnsubscribe = null;

/**
 * Inisialisasi FCM: minta izin notifikasi, daftarkan token ke Firestore.
 * Dipanggil dari tombol "Aktifkan Notifikasi" di halaman Pengaturan.
 */
window.initFCM = async () => {
    if (!FCM_SUPPORTED) {
        window.notify("Perangkat/browser Anda tidak mendukung push notification.", "error");
        return false;
    }

    try {
        let token = null;

        if (IS_NATIVE) {
            console.log("[FCM] Native platform detected. Requesting native FCM permissions...");
            const permissionRes = await window.Capacitor.Plugins.FirebaseMessaging.requestPermissions();
            if (permissionRes.receive !== "granted") {
                window.notify("Izin notifikasi ditolak. Aktifkan di pengaturan HP Anda.", "error");
                return false;
            }

            console.log("[FCM] Requesting native FCM token...");
            const tokenRes = await window.Capacitor.Plugins.FirebaseMessaging.getToken();
            token = tokenRes.token;
        } else {
            // Cek apakah service worker sudah terdaftar
            const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
            console.log("[FCM] Service Worker registered:", swReg);

            // Init messaging
            window.fcmMessaging = firebase.messaging();

            // Minta izin notifikasi dari user
            const permission = await Notification.requestPermission();
            if (permission !== "granted") {
                window.notify("Izin notifikasi ditolak. Aktifkan di pengaturan browser.", "error");
                return false;
            }

            // Ambil FCM token
            token = await window.fcmMessaging.getToken({
                vapidKey: FCM_VAPID_KEY,
                serviceWorkerRegistration: swReg
            });
        }

        if (!token) {
            window.notify("Gagal mendapatkan token notifikasi.", "error");
            return false;
        }

        window.fcmCurrentToken = token;
        console.log("[FCM] Token:", token);

        // Simpan token ke Firestore agar bisa dilihat admin
        await window.saveFCMToken(token);

        // Set listeners
        if (IS_NATIVE) {
            // Hapus listener lama jika ada
            await window.Capacitor.Plugins.FirebaseMessaging.removeAllListeners();
            // Listener untuk notifikasi yang masuk saat aplikasi terbuka (foreground)
            await window.Capacitor.Plugins.FirebaseMessaging.addListener("notificationReceived", (event) => {
                console.log("[FCM Native] Foreground message:", event);
                const title = event.notification?.title || "Notifikasi Baru";
                const body = event.notification?.body || "";
                window.showFCMToast(title, body);
            });
        } else if (window.fcmMessaging) {
            // Listener untuk notifikasi yang masuk saat aplikasi terbuka di browser web
            window.fcmMessaging.onMessage((payload) => {
                console.log("[FCM] Foreground message:", payload);
                const title = payload.notification?.title || "Notifikasi Baru";
                const body = payload.notification?.body || "";
                window.showFCMToast(title, body);
            });
        }

        // Start Firestore real-time notification listeners
        if (typeof window.startFCMListeners === "function") {
            window.startFCMListeners();
        }

        // Update UI tombol notifikasi
        window.updateNotificationButtonState(true);
        window.notify("🔔 Notifikasi push berhasil diaktifkan!", "success");
        return true;

    } catch (err) {
        console.error("[FCM] Error:", err);
        window.notify("Gagal mengaktifkan notifikasi: " + (err.message || err), "error");
        return false;
    }
};

/**
 * Simpan token FCM ke Firestore (koleksi fcm_tokens).
 * Token diasosiasikan dengan user yang sedang login.
 */
window.saveFCMToken = async (token) => {
    try {
        const user = window.STATE?.user;
        if (!user) return;

        const tokenData = {
            token: token,
            user_uid: user.uid || "",
            user_email: user.email || "",
            user_nama: user.nama || "",
            user_role: user.role || "",
            device: navigator.userAgent.substring(0, 100),
            updated_at: new Date().toISOString(),
            platform: "web"
        };

        // Gunakan token sebagai ID dokumen untuk mencegah duplikat
        await window.db.collection("fcm_tokens").doc(token.substring(0, 100)).set(tokenData, { merge: true });
        console.log("[FCM] Token saved to Firestore");

        // Simpan lokal agar tahu notif sudah aktif
        localStorage.setItem("fcm_token", token);
        localStorage.setItem("fcm_enabled", "true");
    } catch (err) {
        console.error("[FCM] Failed to save token:", err);
    }
};

/**
 * Nonaktifkan notifikasi: hapus token dari Firestore & localStorage.
 */
window.disableFCM = async () => {
    try {
        // Stop Firestore real-time notification listeners
        if (typeof window.stopFCMListeners === "function") {
            window.stopFCMListeners();
        }

        const token = localStorage.getItem("fcm_token");
        if (token && window.db) {
            await window.db.collection("fcm_tokens").doc(token.substring(0, 100)).delete();
        }
        if (window.fcmMessaging) {
            await window.fcmMessaging.deleteToken();
        }
        localStorage.removeItem("fcm_token");
        localStorage.removeItem("fcm_enabled");
        window.fcmCurrentToken = null;
        window.updateNotificationButtonState(false);
        window.notify("Notifikasi dinonaktifkan.", "success");
    } catch (err) {
        console.error("[FCM] Disable error:", err);
        window.notify("Gagal menonaktifkan notifikasi.", "error");
    }
};

// ── Real-time Firestore Listeners ─────────────────────────────────────────────
window.startFCMListeners = () => {
    // Pastikan tidak ada double listeners
    window.stopFCMListeners();

    if (!window.db) {
        console.warn("[FCM Listener] Database instance not found. Cannot start listeners.");
        return;
    }

    console.log("[FCM Listener] Starting real-time Firestore listeners for notifications...");

    // 1. Dengar pendaftaran alumni baru (status: "pending")
    let isInitialAlumni = true;
    try {
        window.alumniUnsubscribe = window.db.collection("alumni")
            .where("status", "==", "pending")
            .onSnapshot((snapshot) => {
                if (isInitialAlumni) {
                    isInitialAlumni = false;
                    console.log("[FCM Listener] Initial alumni snapshot silent.");
                    return;
                }
                
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        const item = change.doc.data();
                        console.log("[FCM Listener] New pending alumnus added:", item);
                        
                        const title = "🔔 Alumni Baru Mendaftar";
                        const body = `${item.nama || "Alumni Baru"} (${item.angkatan || ""}) mendaftar dan menunggu verifikasi.`;
                        
                        if (typeof window.triggerLocalNotification === "function") {
                            window.triggerLocalNotification(title, body, {
                                type: "alumni",
                                id: change.doc.id
                            });
                        } else {
                            window.showFCMToast(title, body);
                        }
                    }
                });
            }, (err) => {
                console.error("[FCM Listener] Alumni listener error:", err);
            });
    } catch (e) {
        console.error("[FCM Listener] Failed to start alumni listener:", e);
    }

    // 2. Dengar pembayaran baru (status: "pending_payment")
    let isInitialFinance = true;
    try {
        window.financeUnsubscribe = window.db.collection("finance")
            .where("status", "==", "pending_payment")
            .onSnapshot((snapshot) => {
                if (isInitialFinance) {
                    isInitialFinance = false;
                    console.log("[FCM Listener] Initial finance snapshot silent.");
                    return;
                }
                
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added") {
                        const item = change.doc.data();
                        console.log("[FCM Listener] New pending payment added:", item);
                        
                        const nominalFormatted = window.formatRupiah 
                            ? window.formatRupiah(Number(item.nominal) || 0) 
                            : `Rp ${Number(item.nominal).toLocaleString('id-ID')}`;
                        
                        const title = "💰 Laporan Pembayaran Baru";
                        const body = `${item.nama_pembayar || "Donasi baru"} sebesar ${nominalFormatted} menunggu verifikasi.`;
                        
                        if (typeof window.triggerLocalNotification === "function") {
                            window.triggerLocalNotification(title, body, {
                                type: "finance",
                                id: change.doc.id
                            });
                        } else {
                            window.showFCMToast(title, body);
                        }
                    }
                });
            }, (err) => {
                console.error("[FCM Listener] Finance listener error:", err);
            });
    } catch (e) {
        console.error("[FCM Listener] Failed to start finance listener:", e);
    }
};

window.stopFCMListeners = () => {
    if (window.alumniUnsubscribe) {
        console.log("[FCM Listener] Stopping alumni listener...");
        window.alumniUnsubscribe();
        window.alumniUnsubscribe = null;
    }
    if (window.financeUnsubscribe) {
        console.log("[FCM Listener] Stopping finance listener...");
        window.financeUnsubscribe();
        window.financeUnsubscribe = null;
    }
};

// ── UI Helpers ────────────────────────────────────────────────────────────────

/**
 * Tampilkan rich toast khusus untuk FCM notification (lebih mencolok dari toast biasa).
 */
window.showFCMToast = (title, body) => {
    const container = document.getElementById("fcm-toast-container") || document.getElementById("toast-container");
    if (!container) {
        // Fallback ke window.notify jika container tidak ada
        window.notify(`🔔 ${title}: ${body}`, "success");
        return;
    }

    const toast = document.createElement("div");
    toast.className = "fcm-toast-item glass border border-indigo-500/30 rounded-2xl p-4 shadow-2xl flex items-start gap-3 transform transition-all duration-500 translate-x-full opacity-0 max-w-sm w-full pointer-events-auto";
    toast.innerHTML = `
        <div class="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <i class="fas fa-bell text-indigo-400 text-sm"></i>
        </div>
        <div class="flex-1 min-w-0">
            <div class="font-black text-white text-xs uppercase tracking-wider">${title}</div>
            <div class="text-slate-300 text-[11px] mt-0.5 leading-relaxed">${body}</div>
        </div>
        <button onclick="this.parentElement.remove()" class="text-slate-500 hover:text-white transition-colors flex-shrink-0">
            <i class="fas fa-times text-xs"></i>
        </button>
    `;

    // Cek ada fcm-toast-container khusus atau tidak
    const fcmContainer = document.getElementById("fcm-toast-container");
    if (fcmContainer) {
        fcmContainer.appendChild(toast);
    } else {
        container.appendChild(toast);
    }

    setTimeout(() => toast.classList.remove("translate-x-full", "opacity-0"), 50);
    setTimeout(() => {
        toast.classList.add("translate-x-full", "opacity-0");
        setTimeout(() => toast.remove(), 500);
    }, 7000);

    // Juga tampilkan native browser notification jika app tidak aktif di tab ini
    if (document.visibilityState !== "visible" || !document.hasFocus()) {
        try {
            new Notification(title, {
                body: body,
                icon: "/img/logo.png",
                badge: "/img/logo.png",
                tag: "reuni-notif",
                requireInteraction: true
            });
        } catch (_) { /* silent */ }
    }
};

/**
 * Update tampilan tombol notifikasi (aktif/nonaktif).
 */
window.updateNotificationButtonState = (isEnabled) => {
    const btnEnable = document.getElementById("btn-enable-notif");
    const btnDisable = document.getElementById("btn-disable-notif");
    const notifStatus = document.getElementById("notif-status-text");
    const notifDot = document.getElementById("notif-status-dot");

    if (btnEnable) btnEnable.classList.toggle("hidden", isEnabled);
    if (btnDisable) btnDisable.classList.toggle("hidden", !isEnabled);

    if (notifStatus) {
        notifStatus.textContent = isEnabled ? "Aktif" : "Nonaktif";
        notifStatus.className = isEnabled
            ? "text-emerald-400 font-black text-xs uppercase tracking-widest"
            : "text-slate-500 font-black text-xs uppercase tracking-widest";
    }

    if (notifDot) {
        notifDot.className = isEnabled
            ? "w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"
            : "w-2.5 h-2.5 rounded-full bg-slate-600";
    }
};

// ── Auto-restore saat page load ───────────────────────────────────────────────
(function checkExistingFCMToken() {
    const enabled = localStorage.getItem("fcm_enabled") === "true";
    const token = localStorage.getItem("fcm_token");

    // Update tombol UI sesuai status simpanan
    setTimeout(() => {
        window.updateNotificationButtonState(enabled && !!token);

        // DEBUG LOGS FOR BUTTONS VISIBILITY
        try {
            const btnEnable = document.getElementById("btn-enable-notif");
            const btnDisable = document.getElementById("btn-disable-notif");
            if (btnEnable) {
                console.log("[FCM DEBUG] btn-enable-notif exists. Classes: " + btnEnable.className + " | Hidden in classList: " + btnEnable.classList.contains("hidden") + " | Offset height: " + btnEnable.offsetHeight + " | Style display: " + btnEnable.style.display);
                console.log("[FCM DEBUG] parent element tag: " + btnEnable.parentElement.tagName + " | parent classes: " + btnEnable.parentElement.className + " | parent display: " + window.getComputedStyle(btnEnable.parentElement).display);
            } else {
                console.error("[FCM DEBUG] btn-enable-notif does NOT exist in DOM!");
            }
        } catch(e) {
            console.error("[FCM DEBUG] Error in debug logs: " + e.message);
        }


        // Jika sebelumnya sudah aktif, coba reconnect messaging (tanpa minta izin lagi)
        if (enabled && token && FCM_SUPPORTED) {
            try {
                // Mulai listener Firestore
                if (typeof window.startFCMListeners === "function") {
                    window.startFCMListeners();
                }

                if (IS_NATIVE) {
                    // Set listener foreground untuk native platform
                    window.Capacitor.Plugins.FirebaseMessaging.removeAllListeners();
                    window.Capacitor.Plugins.FirebaseMessaging.addListener("notificationReceived", (event) => {
                        console.log("[FCM Native] Foreground message (reconnected):", event);
                        const title = event.notification?.title || "Notifikasi Baru";
                        const body = event.notification?.body || "";
                        window.showFCMToast(title, body);
                    });
                } else if (!window.fcmMessaging && typeof firebase !== "undefined" && firebase.messaging) {
                    window.fcmMessaging = firebase.messaging();
                    window.fcmMessaging.onMessage((payload) => {
                        const title = payload.notification?.title || "Notifikasi Baru";
                        const body = payload.notification?.body || "";
                        window.showFCMToast(title, body);
                    });
                }
            } catch (e) {
                console.warn("[FCM] Auto-reconnect failed:", e);
            }
        }
    }, 2000);
})();

console.log("[FCM] Module loaded. Browser support:", FCM_SUPPORTED);
