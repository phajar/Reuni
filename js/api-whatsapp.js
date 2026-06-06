// ==========================================
// TAHAP 2 & 4: MANAJEMEN WHATSAPP SERVER & BROADCAST (Internal)
// ==========================================

// --- MANAJEMEN BOT DINAMIS ---
window.isWaConnected = false;
window.waBots = JSON.parse(localStorage.getItem('wa_bots')) || [
    { id: 'bot-reuni', name: 'Bot Utama (bot-reuni)' },
    { id: 'bot-panitia', name: 'Bot Panitia (bot-panitia)' },
    { id: 'bot-keuangan', name: 'Bot Keuangan (bot-keuangan)' }
];
window.waRoles = JSON.parse(localStorage.getItem('wa_roles')) || {
    broadcast: 'bot-reuni',
    finance: 'bot-keuangan'
};
window.currentWaSessionId = localStorage.getItem('wa_current_session') || window.waBots[0].id;

window.saveBotsData = () => {
    localStorage.setItem('wa_bots', JSON.stringify(window.waBots));
    localStorage.setItem('wa_roles', JSON.stringify(window.waRoles));
    localStorage.setItem('wa_current_session', window.currentWaSessionId);
};

window.renderBotDropdowns = () => {
    const mainSelect = document.getElementById('wa-session-select');
    const bcSelect = document.getElementById('wa-role-broadcast');
    const finSelect = document.getElementById('wa-role-finance');
    
    if(!mainSelect) return;

    const optionsHTML = window.waBots.map(b => `<option value="${b.id}" style="color:black;">${b.name}</option>`).join('');
    
    mainSelect.innerHTML = optionsHTML;
    if(bcSelect) bcSelect.innerHTML = optionsHTML;
    if(finSelect) finSelect.innerHTML = optionsHTML;

    mainSelect.value = window.currentWaSessionId;
    if(bcSelect) bcSelect.value = window.waRoles.broadcast || window.waBots[0].id;
    if(finSelect) finSelect.value = window.waRoles.finance || window.waBots[0].id;
};

window.promptAddBot = () => {
    const name = prompt("Masukkan nama untuk Bot baru (contoh: Bot CS):");
    if(!name) return;
    const id = 'bot-' + name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if(window.waBots.find(b => b.id === id)) return window.notify('Bot dengan nama mirip sudah ada!', 'error');
    
    window.waBots.push({ id, name: `${name} (${id})` });
    window.currentWaSessionId = id;
    window.saveBotsData();
    window.renderBotDropdowns();
    window.startWAServer();
};

window.deleteCurrentBot = () => {
    if(window.waBots.length <= 1) return window.notify('Anda harus memiliki setidaknya 1 bot!', 'error');
    if(!confirm(`Hapus bot ${window.currentWaSessionId}? Sesi WhatsApp akan terputus dari perangkat ini.`)) return;
    
    window.waBots = window.waBots.filter(b => b.id !== window.currentWaSessionId);
    window.currentWaSessionId = window.waBots[0].id;
    window.saveBotsData();
    window.renderBotDropdowns();
    window.startWAServer();
};

window.saveBotRoles = async () => {
    const bcSelect = document.getElementById('wa-role-broadcast');
    const finSelect = document.getElementById('wa-role-finance');
    if(bcSelect) window.waRoles.broadcast = bcSelect.value;
    if(finSelect) window.waRoles.finance = finSelect.value;
    window.saveBotsData();
    try {
        await db.collection('settings').doc('wa_bot_roles').set(window.waRoles);
    } catch (e) {
        console.error("Gagal sync peran bot ke Firestore:", e);
    }
    window.notify('Pengaturan peran bot disimpan', 'success');
};

window.changeWaSession = (newSessionId) => {
    window.currentWaSessionId = newSessionId;
    window.saveBotsData();
    console.log('[WA] Mengganti sesi aktif ke:', newSessionId);
    window.startWAServer();
};

const initWhatsApp = async () => {
  window.renderBotDropdowns();
  try {
      const docSnap = await db.collection('settings').doc('wa_bot_roles').get();
      if (docSnap.exists) {
          window.waRoles = docSnap.data();
          localStorage.setItem('wa_roles', JSON.stringify(window.waRoles));
          window.renderBotDropdowns();
      }
  } catch (e) {
      console.warn("Gagal memuat peran bot dari Firestore:", e);
  }
  setTimeout(() => {
    if (typeof initWhatsAppEngine === 'function') {
      initWhatsAppEngine();
    }
  }, 50);
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWhatsApp);
} else {
  initWhatsApp();
}
// -----------------------------

window.populateSelectWithSaved = (selectEl, jidValue, groupsList, placeholder = '-- Pilih Grup --') => {
    if (!selectEl) return;
    let hasJid = false;
    let optionsHtml = `<option value="">${placeholder}</option>`;
    groupsList.forEach(g => {
        const isSelected = g.jid === jidValue;
        if (isSelected) hasJid = true;
        optionsHtml += `<option value="${g.jid}" data-name="${g.nama_grup || g.name || ''}" ${isSelected ? 'selected' : ''}>${g.nama_grup || g.name || g.jid}</option>`;
    });
    if (jidValue && !hasJid) {
        optionsHtml += `<option value="${jidValue}" selected>Terarsip/Belum Sinkron: ${jidValue}</option>`;
    }
    selectEl.innerHTML = optionsHtml;
    if (jidValue) {
        selectEl.value = jidValue;
    }
};

// --- WHATSAPP CONFIG LOAD HELPER (FIRESTORE) ---
window.getWaApiConfig = async () => {
    if (window.lastWaApiConfig && Object.keys(window.lastWaApiConfig).length > 0) {
        return window.lastWaApiConfig;
    }
    try {
        const docSnap = await db.collection("settings").doc("whatsapp_api").get();
        if (docSnap.exists) {
            const data = docSnap.data();
            window.lastWaApiConfig = data;
            console.log("[WA Config] Loaded from Firestore successfully.");
            return data;
        }
    } catch (e) {
        console.error("[WA Config] Failed to load from Firestore:", e);
    }
    return {};
};

window.startWAServer = async () => {
    try {
        if (!window.Capacitor || !window.Capacitor.Plugins.CapacitorNodeJS) {
            if (typeof window.checkLocalWaStatus === 'function') {
                window.notify('Menyegarkan status koneksi lokal...', 'info');
                await window.checkLocalWaStatus();
            } else {
                window.notify('Plugin Node.js tidak tersedia di platform ini.', 'error');
            }
            return;
        }
        
        // Meminta Izin Akses Penyimpanan (sebagai formalitas untuk perangkat tertentu)
        if (window.Capacitor.Plugins.Filesystem) {
            try {
                await window.Capacitor.Plugins.Filesystem.requestPermissions();
            } catch(e) {
                console.log("Filesystem permission request error:", e);
            }
        }

        // Ubah state UI langsung (tanpa toggleLoading fullscreen)
        const loadingState = document.getElementById('wa-loading-state');
        const qrCodeEl = document.getElementById('wa-qr-code');
        const connectedState = document.getElementById('wa-connected-state');
        
        if (loadingState) loadingState.classList.remove('hidden');
        if (qrCodeEl) qrCodeEl.classList.add('hidden');
        if (connectedState) connectedState.classList.add('hidden');

        // Kirim event untuk start session
        await window.Capacitor.Plugins.CapacitorNodeJS.send({
            eventName: 'start_session',
            args: [{ sessionId: window.currentWaSessionId }]
        });
    } catch(err) {
        if (err.message && err.message.includes("not ready yet")) {
            window.notify('Sistem sedang mempersiapkan library WhatsApp. Harap tunggu sekitar 5-10 detik lalu coba lagi.', 'warning');
        } else {
            window.notify('Gagal memulai server: ' + err.message, 'error');
        }
    }
};

window.stopWAServer = () => {
    if(!confirm('Matikan WhatsApp Internal di HP Anda?')) return;
    if (window.Capacitor && window.Capacitor.Plugins.CapacitorNodeJS) {
        window.Capacitor.Plugins.CapacitorNodeJS.send({
            eventName: 'stop_session',
            args: [{ sessionId: window.currentWaSessionId }]
        });
        window.notify('Menonaktifkan WhatsApp Internal...', 'warning');
    } else {
        window.notify('Plugin Node.js tidak tersedia.', 'error');
    }
};

window.resetWASession = async () => {
    if(!confirm('Anda yakin ingin mereset sesi WhatsApp? Anda harus scan QR ulang.')) return;
    
    const isNative = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorNodeJS);
    
    if (isNative) {
        window.Capacitor.Plugins.CapacitorNodeJS.send({
            eventName: 'reset_session',
            args: [{ sessionId: window.currentWaSessionId }]
        });
        window.notify('Mereset sesi...', 'warning');
    } else {
        const config = await window.getWaApiConfig();
        
        const localUrl = (config && config.local_api_url || '').trim();
        if (!localUrl) {
            return window.notify('API WhatsApp Lokal belum diatur di panel kiri!', 'error');
        }
        
        let cleanLocalUrl = localUrl;
        let localApiKey = '';
        if (cleanLocalUrl.includes('|')) {
            const parts = cleanLocalUrl.split('|');
            cleanLocalUrl = parts[0].trim();
            localApiKey = parts[1].trim();
        }
        if (cleanLocalUrl.endsWith('/')) {
            cleanLocalUrl = cleanLocalUrl.slice(0, -1);
        }
        
        window.toggleLoading(true, 'Mereset sesi WhatsApp...');
        window.notify('Mengirim permintaan reset sesi...', 'warning');
        
        try {
            const headers = {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            };
            if (localApiKey) {
                headers['Authorization'] = `Bearer ${localApiKey}`;
            }
            const res = await fetch(`${cleanLocalUrl}/api/reset`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ sessionId: window.currentWaSessionId })
            });
            const data = await res.json();
            window.toggleLoading(false);
            
            if (data && data.success) {
                window.notify('Sesi WhatsApp berhasil direset. Silakan scan QR code baru.', 'success');
            } else {
                window.notify('Gagal mereset sesi: ' + (data.error || 'Server error'), 'error');
            }
        } catch (err) {
            window.toggleLoading(false);
            window.notify('Gagal menghubungi API lokal: ' + err.message, 'error');
        }
    }
};

window.exportWASession = () => {
    if (window.Capacitor && window.Capacitor.Plugins.CapacitorNodeJS) {
        window.Capacitor.Plugins.CapacitorNodeJS.send({
            eventName: 'export_session',
            args: [{ sessionId: window.currentWaSessionId }]
        });
        window.notify('Mengexport Sesi ke Google Drive...', 'warning');
    } else {
        window.notify('Plugin Node.js tidak tersedia.', 'error');
    }
};

window.importWASession = () => {
    if(!confirm('Perhatian: Mengambil sesi dari Google Drive akan menimpa sesi saat ini.')) return;
    if (window.Capacitor && window.Capacitor.Plugins.CapacitorNodeJS) {
        window.Capacitor.Plugins.CapacitorNodeJS.send({
            eventName: 'import_session',
            args: [{ sessionId: window.currentWaSessionId }]
        });
        window.notify('Mengimport Sesi dari Google Drive...', 'warning');
    } else {
        window.notify('Plugin Node.js tidak tersedia.', 'error');
    }
};

window.requestWaPairing = async () => {
    const phone = document.getElementById('wa-phone-input').value;
    if (!phone) return window.notify('Masukkan nomor telepon tujuan!', 'error');
    
    const isNative = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorNodeJS);
    
    if (isNative) {
        window.toggleLoading(true, 'Meminta kode tautan...');
        window.notify('Mengirim permintaan kode tautan ke nomor ' + phone + '...', 'warning');
        window.Capacitor.Plugins.CapacitorNodeJS.send({
            eventName: 'request_pairing',
            args: [{ sessionId: window.currentWaSessionId, phone: phone }]
        });
    } else {
        const config = await window.getWaApiConfig();
        
        const localUrl = (config && config.local_api_url || '').trim();
        if (!localUrl) {
            return window.notify('API WhatsApp Lokal belum diatur di panel kiri!', 'error');
        }
        
        let cleanLocalUrl = localUrl;
        let localApiKey = '';
        if (cleanLocalUrl.includes('|')) {
            const parts = cleanLocalUrl.split('|');
            cleanLocalUrl = parts[0].trim();
            localApiKey = parts[1].trim();
        }
        if (cleanLocalUrl.endsWith('/')) {
            cleanLocalUrl = cleanLocalUrl.slice(0, -1);
        }
        
        window.toggleLoading(true, 'Meminta kode tautan dari server lokal...');
        window.notify('Mengirim permintaan kode tautan ke nomor ' + phone + '...', 'warning');
        
        try {
            const headers = {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            };
            if (localApiKey) {
                headers['Authorization'] = `Bearer ${localApiKey}`;
            }
            const res = await fetch(`${cleanLocalUrl}/api/pair`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ sessionId: window.currentWaSessionId, phone: phone })
            });
            const data = await res.json();
            window.toggleLoading(false);
            
            if (data && data.success) {
                const display = document.getElementById('wa-pairing-code-display');
                const textCode = document.getElementById('wa-pairing-code-text');
                if (display && textCode) {
                    display.classList.remove('hidden');
                    let code = data.code || '';
                    if (code.length === 8) code = code.substring(0,4) + '-' + code.substring(4);
                    textCode.innerText = code;
                    window.notify('Kode tautan: ' + code, 'success');
                }
            } else {
                window.notify('Gagal meminta kode: ' + (data.error || 'Server error'), 'error');
            }
        } catch (err) {
            window.toggleLoading(false);
            window.notify('Gagal menghubungi API lokal: ' + err.message, 'error');
        }
    }
};

// ==========================================
// MENGGUNAKAN WHATSAPP INTERNAL UNTUK SEND
// ==========================================

// Fungsi universal pengirim pesan WhatsApp
// Secara otomatis mendeteksi lingkungan:
// 1. Lingkungan Aplikasi (Capacitor NodeJS): Menggunakan server lokal Node.js
// 2. Lingkungan Web (Browser): Menggunakan REST API langsung (Fonnte, WooWA, StarSender, Custom/Hugging Face)
window.sendWhatsAppInternal = async (target, message, fileUrl = null, roleName = null, fileType = null) => {
    // Bypass WhatsApp sending if globally disabled in settings (Testing Mode)
    if (window.STATE && window.STATE.eventInfo && window.STATE.eventInfo.wa_disabled === true) {
        console.log(`[WA] WhatsApp is globally disabled (Testing Mode). Skipping message to ${target}`);
        return true; 
    }

    let targetSessionId = window.currentWaSessionId;
    if (roleName && window.waRoles[roleName]) {
        targetSessionId = window.waRoles[roleName];
    }

    // A. JIKA BERJALAN DI LINGKUNGAN APLIKASI (Capacitor NodeJS)
    if (window.Capacitor && window.Capacitor.Plugins.CapacitorNodeJS) {
        return new Promise((resolve, reject) => {

            // Random message ID to track response
            const msgId = Date.now().toString();
            
            // Timeout
            const timeoutId = setTimeout(() => {
                reject(new Error("Timeout mengirim pesan"));
            }, 15000);

            // Listen for result
            let handle = null;
            const listenerPromise = window.Capacitor.Plugins.CapacitorNodeJS.addListener('send_result', (data) => {
                const dataObj = data.args ? data.args[0] : data;
                if (dataObj.msgId === msgId) {
                    clearTimeout(timeoutId);
                    if (handle && typeof handle.remove === 'function') {
                        handle.remove();
                    } else if (listenerPromise) {
                        if (typeof listenerPromise.then === 'function') {
                            listenerPromise.then(h => {
                                if (h && typeof h.remove === 'function') h.remove();
                            }).catch(e => {});
                        } else if (typeof listenerPromise.remove === 'function') {
                            listenerPromise.remove();
                        }
                    }
                    if (dataObj.ok) {
                        resolve(true);
                    } else {
                        reject(new Error(dataObj.error || "Gagal mengirim pesan"));
                    }
                }
            });

            if (listenerPromise && typeof listenerPromise.then === 'function') {
                listenerPromise.then(h => { handle = h; }).catch(e => {});
            } else {
                handle = listenerPromise;
            }

            window.Capacitor.Plugins.CapacitorNodeJS.send({
                eventName: 'send_message',
                args: [{
                    msgId,
                    sessionId: targetSessionId,
                    target: target,
                    message: message,
                    fileUrl: fileUrl,
                    fileType: fileType
                }]
            });
        });
    }

    // B. JIKA BERJALAN DI LINGKUNGAN WEB/BROWSER (MENGGUNAKAN API GATEWAY LANGSUNG)
    try {
        console.log('[WA] Mengirim pesan via Web API...');
        const config = await window.getWaApiConfig();
        if (!config || Object.keys(config).length === 0) {
            console.warn('[WA] Pengaturan API WA belum diset.');
            return false;
        }
        
        // 1. Cek apakah ada API WhatsApp Lokal (Baileys) dan aktif
        const localUrl = (config.local_api_url || '').trim();
        let sentViaLocal = false;
        if (localUrl) {
            let cleanLocalUrl = localUrl;
            let localApiKey = '';
            if (cleanLocalUrl.includes('|')) {
                const parts = cleanLocalUrl.split('|');
                cleanLocalUrl = parts[0].trim();
                localApiKey = parts[1].trim();
            }
            if (cleanLocalUrl.endsWith('/')) {
                cleanLocalUrl = cleanLocalUrl.slice(0, -1);
            }
            
            console.log(`[WA] Mencoba kirim via server lokal: ${cleanLocalUrl}`);
            let isLocalOpen = false;
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 detik timeout
                
                const statusHeaders = { 'ngrok-skip-browser-warning': 'true' };
                if (localApiKey) {
                    statusHeaders['Authorization'] = `Bearer ${localApiKey}`;
                }
                const statusRes = await fetch(`${cleanLocalUrl}/api/status`, { 
                    headers: statusHeaders,
                    signal: controller.signal 
                });
                clearTimeout(timeoutId);
                
                const statusData = await statusRes.json();
                if (statusData && statusData.status === 'open') {
                    isLocalOpen = true;
                }
            } catch (statusErr) {
                console.warn('[WA] Gagal menghubungi API lokal (offline/timeout):', statusErr.message);
            }

            if (isLocalOpen) {
                console.log('[WA] Server lokal terdeteksi aktif dan terhubung. Mengirim...');
                try {
                    let cleanPhone;
                    if (target.includes('@')) {
                        cleanPhone = target;
                    } else {
                        cleanPhone = target.replace(/\D/g, '');
                        if (cleanPhone.startsWith('08')) {
                            cleanPhone = '628' + cleanPhone.substring(2);
                        }
                    }
                    
                    const sendHeaders = { 
                        'Content-Type': 'application/json',
                        'ngrok-skip-browser-warning': 'true'
                    };
                    if (localApiKey) {
                        sendHeaders['Authorization'] = `Bearer ${localApiKey}`;
                    }
                    const sendRes = await fetch(`${cleanLocalUrl}/send-message`, {
                        method: 'POST',
                        headers: sendHeaders,
                        body: JSON.stringify({
                            sessionId: targetSessionId,
                            phone: cleanPhone,
                            message: message,
                            fileUrl: fileUrl,
                            fileType: fileType
                        })
                    });
                    
                    if (!sendRes.ok) {
                        if (sendRes.status === 413) {
                            throw new Error('Ukuran file laporan terlalu besar untuk dikirim oleh server WhatsApp lokal (Payload Too Large 413).');
                        }
                        throw new Error(`Server lokal mengembalikan error HTTP ${sendRes.status}.`);
                    }
                    
                    const sendData = await sendRes.json();
                    if (sendData && sendData.success) {
                        console.log('[WA] Pesan sukses terkirim via API lokal ke', cleanPhone);
                        sentViaLocal = true;
                        return true;
                    } else {
                        throw new Error(sendData.error || 'Server lokal gagal memproses pengiriman pesan.');
                    }
                } catch (sendErr) {
                    console.error('[WA] Gagal mengirim via bot lokal:', sendErr.message);
                    throw new Error('Gagal mengirim via WhatsApp Lokal: ' + sendErr.message);
                }
            }
        }
        
        // Default ke settings broadcast jika lokal tidak aktif/tidak diisi
        let provider = config.provider_broadcast || 'fonnte';
        let token = config.token_broadcast || '';
        
        // Arahkan ke settings keuangan / verifikasi jika sesuai roleName
        if (roleName === 'finance') {
            provider = config.provider_keuangan || provider;
            token = config.token_keuangan || token;
        } else if (roleName === 'verifikasi') {
            provider = config.provider_verifikasi || provider;
            token = config.token_verifikasi || token;
        }

        // Bersihkan & format nomor telepon
        let cleanPhone = target.replace(/\D/g, '');
        if (cleanPhone.startsWith('08')) {
            cleanPhone = '628' + cleanPhone.substring(2);
        }
        
        if (provider === 'custom') {
            let serverUrl = token.trim();
            let apiKey = '';
            if (serverUrl.includes('|')) {
                const parts = serverUrl.split('|');
                serverUrl = parts[0].trim();
                apiKey = parts[1].trim();
            }
            if (!serverUrl) {
                console.error('[WA] URL Server Custom / Hugging Face Kosong!');
                return false;
            }
            if (serverUrl.endsWith('/')) {
                serverUrl = serverUrl.slice(0, -1);
            }
            
            console.log(`[WA] Mengirim ke ${serverUrl}/send-message untuk target ${cleanPhone}`);
            const customHeaders = {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            };
            if (apiKey) {
                customHeaders['Authorization'] = `Bearer ${apiKey}`;
            }
            const response = await fetch(`${serverUrl}/send-message`, {
                method: 'POST',
                headers: customHeaders,
                body: JSON.stringify({
                    sessionId: targetSessionId,
                    phone: cleanPhone,
                    message: message,
                    fileUrl: fileUrl,
                    fileType: fileType
                })
            });
            const resData = await response.json();
            return resData.success === true;
            
        } else if (provider === 'fonnte') {
            console.log(`[WA] Mengirim ke Fonnte untuk target ${cleanPhone}`);
            const formData = new FormData();
            formData.append('target', cleanPhone);
            formData.append('message', message);
            if (fileUrl) {
                formData.append('url', fileUrl);
            }
            
            const response = await fetch('https://api.fonnte.com/send', {
                method: 'POST',
                headers: {
                    'Authorization': token.trim()
                },
                body: formData
            });
            const resData = await response.json();
            if (resData.status === true || resData.status === 'true') {
                console.log('[WA] Pesan terkirim via Fonnte ke', cleanPhone);
                return true;
            } else {
                console.error('[WA] Gagal mengirim via Fonnte:', resData.reason || resData.message || resData);
                return false;
            }
            
        } else if (provider === 'woowa') {
            console.log(`[WA] Mengirim ke WooWA untuk target ${cleanPhone}`);
            const payload = {
                key: token.trim(),
                phone_no: cleanPhone,
                phone: cleanPhone,
                message: message
            };
            
            const response = await fetch('https://api.woo-wa.com/send_message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const text = await response.text();
            if (text.toLowerCase().includes('sukses') || text.toLowerCase().includes('success') || text.length > 5) {
                console.log('[WA] Pesan terkirim via WooWA ke', cleanPhone);
                return true;
            } else {
                console.error('[WA] Gagal mengirim via WooWA:', text);
                return false;
            }
            
        } else if (provider === 'starsender') {
            console.log(`[WA] Mengirim ke StarSender untuk target ${cleanPhone}`);
            const payload = {
                tujuan: cleanPhone + '@s.whatsapp.net',
                number: cleanPhone,
                message: message,
                apikey: token.trim()
            };
            
            const response = await fetch('https://api.starsender.co/api/sendText', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': token.trim()
                },
                body: JSON.stringify(payload)
            });
            const resData = await response.json();
            if (resData.status === true || resData.status === 'true' || resData.message === 'success') {
                console.log('[WA] Pesan terkirim via StarSender ke', cleanPhone);
                return true;
            } else {
                console.error('[WA] Gagal mengirim via StarSender:', resData.message || resData);
                return false;
            }
        } else {
            console.warn(`[WA] Provider ${provider} tidak didukung di versi web murni.`);
            return false;
        }
    } catch (e) {
        console.error('[WA] Gagal mengirim WhatsApp:', e);
        return false;
    }
};

window.sendWhatsAppAPI = async (target, message, fileUrl = null, someParam = null, roleName = null, fileType = null) => {
    let role = 'broadcast';
    if (roleName && roleName.toLowerCase().includes('keuangan')) {
        role = 'finance';
    }
    return window.sendWhatsAppInternal(target, message, fileUrl, role, fileType);
};

window.openModalBroadcast = async (isGlobal = false) => {
    if(!isGlobal && (!window.selectedAlumni || window.selectedAlumni.size === 0)) return window.notify('Pilih alumni dulu', 'error');
    
    window.toggleLoading(true, 'Memuat Data...');
    try {
        await window.loadWaGroups(); 
        
        const groupListContainer = document.getElementById('broadcast-group-list');
        if (window.waGroups && window.waGroups.length > 0) {
            groupListContainer.innerHTML = window.waGroups.map((g, i) => `
                <label class="flex items-center gap-2 cursor-pointer bg-white/5 p-2 rounded-lg border border-white/10 hover:bg-white/10 transition-colors m-0">
                    <input type="checkbox" value="${window.escapeHtml(g.jid)}" class="bc-group-checkbox w-4 h-4 rounded border-white/10 bg-black/20 text-emerald-500 focus:ring-emerald-500">
                    <span class="text-xs font-bold text-slate-300">Grup: ${window.escapeHtml(g.nama_grup)}</span>
                </label>
            `).join('');
        } else {
            groupListContainer.innerHTML = '<p class="text-[10px] text-slate-500 italic md:col-span-2">Belum ada grup yang disetting.</p>';
        }

        const alumniCountEl = document.getElementById('broadcast-alumni-count');
        if (window.selectedAlumni && window.selectedAlumni.size > 0) {
            document.getElementById('bc-alumni-num').innerText = window.selectedAlumni.size;
            alumniCountEl.classList.remove('hidden');
        } else {
            alumniCountEl.classList.add('hidden');
        }

        const templateAwal = "Assalamu'alaikum wr. wb.\n\nHalo *[Nama]*,\n\nKami dari Panitia Reuni Akbar AL-FATAH ingin mengingatkan...\n\nTerima kasih.";
        document.getElementById('broadcast-msg-input').value = templateAwal;
        document.getElementById('broadcast-file').value = ''; // Reset file input

        // Reset progress bar agar tidak ada sisa visual dari broadcast sebelumnya
        window.broadcastPaused = false;
        window.broadcastCancelled = false;
        const progressContainer = document.getElementById('broadcast-progress-container');
        const progressBar = document.getElementById('broadcast-progress-bar');
        const percentageText = document.getElementById('broadcast-percentage-text');
        const statusText = document.getElementById('broadcast-status-text');
        if (progressContainer) progressContainer.classList.add('hidden');
        if (progressBar) progressBar.style.width = '0%';
        if (percentageText) percentageText.innerText = '0%';
        if (statusText) statusText.innerText = '';
        const btnPause = document.getElementById('btn-pause-broadcast');
        if (btnPause) {
            btnPause.innerHTML = '<i class="fas fa-pause mr-1"></i> Jeda';
            btnPause.className = 'flex-1 py-2 rounded-lg font-bold bg-amber-600 hover:bg-amber-500 text-[9px] uppercase tracking-wider text-white shadow-md transition-all';
        }
        
        window.openModal('modal-broadcast');
    } catch(e) { window.notify('Gagal memuat form broadcast', 'error'); } 
    finally { window.toggleLoading(false); }
};

window.broadcastPaused = false;
window.broadcastCancelled = false;

window.togglePauseBroadcast = () => {
    window.broadcastPaused = !window.broadcastPaused;
    const btn = document.getElementById('btn-pause-broadcast');
    if (btn) {
        if (window.broadcastPaused) {
            btn.innerHTML = '<i class="fas fa-play mr-1"></i> Lanjutkan';
            btn.className = 'flex-1 py-2 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-500 text-[9px] uppercase tracking-wider text-white shadow-md transition-all';
            window.notify('Pengiriman dijeda', 'warning');
        } else {
            btn.innerHTML = '<i class="fas fa-pause mr-1"></i> Jeda';
            btn.className = 'flex-1 py-2 rounded-lg font-bold bg-amber-600 hover:bg-amber-500 text-[9px] uppercase tracking-wider text-white shadow-md transition-all';
            window.notify('Pengiriman dilanjutkan', 'success');
        }
    }
};

window.cancelBroadcast = () => {
    window.broadcastCancelled = true;
    window.notify('Menghentikan pengiriman...', 'warning');
};

window.executeBroadcastWA = async () => {
    const pesanTemplate = document.getElementById('broadcast-msg-input').value;
    if (!pesanTemplate.trim()) return window.notify('Pesan tidak boleh kosong!', 'error');

    const groupCheckboxes = document.querySelectorAll('.bc-group-checkbox:checked');
    const selectedGroups = Array.from(groupCheckboxes).map(cb => cb.value); 
    const selectedAlumniIds = window.selectedAlumni ? Array.from(window.selectedAlumni) : [];
    
    if (selectedAlumniIds.length === 0 && selectedGroups.length === 0) return window.notify('Pilih minimal 1 Alumni atau 1 Grup Target!', 'error');

    // Ambil jeda pengiriman
    const delayVal = document.getElementById('broadcast-delay-select').value; // e.g. "3-5"
    const delayParts = delayVal.split('-');
    const minDelay = parseFloat(delayParts[0]) || 3;
    const maxDelay = parseFloat(delayParts[1]) || 5;

    // Reset status & Progress UI
    window.broadcastPaused = false;
    window.broadcastCancelled = false;
    
    const progressContainer = document.getElementById('broadcast-progress-container');
    const progressBar = document.getElementById('broadcast-progress-bar');
    const percentageText = document.getElementById('broadcast-percentage-text');
    const statusText = document.getElementById('broadcast-status-text');
    
    const btnPause = document.getElementById('btn-pause-broadcast');
    if (btnPause) {
        btnPause.innerHTML = '<i class="fas fa-pause mr-1"></i> Jeda';
        btnPause.className = 'flex-1 py-2 rounded-lg font-bold bg-amber-600 hover:bg-amber-500 text-[9px] uppercase tracking-wider text-white shadow-md transition-all';
    }

    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    percentageText.innerText = '0%';
    statusText.innerText = 'Menyiapkan pengiriman...';

    // Elemen input yang harus dinonaktifkan
    const inputFields = [
        document.getElementById('broadcast-msg-input'),
        document.getElementById('broadcast-file'),
        document.getElementById('broadcast-delay-select'),
        document.getElementById('btn-close-broadcast-modal'),
        document.getElementById('btn-start-broadcast')
    ];
    // Tambahkan checkbox grup WA
    groupCheckboxes.forEach(cb => inputFields.push(cb));

    // Disable all inputs
    inputFields.forEach(el => { if (el) el.disabled = true; });
    
    // Upload Attachment if any
    const fileInput = document.getElementById('broadcast-file');
    let fileUrl = null;
    
    if (fileInput.files.length > 0) {
        statusText.innerText = 'Menyiapkan lampiran...';
        const file = fileInput.files[0];
        
        try {
            const CapCore = window.capacitorExports ? window.capacitorExports.Capacitor : window.Capacitor;
            if (CapCore && CapCore.Plugins && CapCore.Plugins.Filesystem) {
                const Filesystem = CapCore.Plugins.Filesystem;
                
                // Konversi file ke base64
                const reader = new FileReader();
                const base64Promise = new Promise((resolve, reject) => {
                    reader.onloadend = () => {
                        const base64 = reader.result.split(',')[1];
                        resolve(base64);
                    };
                    reader.onerror = reject;
                });
                reader.readAsDataURL(file);
                const base64Data = await base64Promise;
                
                // Tulis file ke CACHE
                const writeResult = await Filesystem.writeFile({
                    path: file.name,
                    data: base64Data,
                    directory: "CACHE",
                    recursive: true
                });
                
                fileUrl = writeResult.uri;
                console.log("[sendBroadcastWA] Saved to local file URI:", fileUrl);
            } else {
                const isPdf = file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
                const uploadUrl = isPdf 
                    ? "https://api.cloudinary.com/v1_1/dowih3wr7/raw/upload" 
                    : "https://api.cloudinary.com/v1_1/dowih3wr7/auto/upload";
                    
                const formData = new FormData();
                formData.append("file", file);
                formData.append("upload_preset", "Reuniakbar"); 
                const cloudRes = await fetch(uploadUrl, { method: "POST", body: formData });
                const cloudData = await cloudRes.json();
                if(cloudData.secure_url) {
                    fileUrl = cloudData.secure_url;
                } else {
                    throw new Error("Gagal mendapatkan URL dari Cloudinary");
                }
            }
        } catch(err) {
            inputFields.forEach(el => { if (el) el.disabled = false; });
            progressContainer.classList.add('hidden');
            return window.notify('Gagal memproses lampiran: ' + err.message, 'error');
        }
    }
    
    // Buat daftar antrean pengiriman
    const queue = [];
    
    // Antrean alumni
    for (let id of selectedAlumniIds) {
        const al = window.STATE.alumni.find(a => a.id === id);
        if (al && al.nowa) {
            queue.push({
                type: 'personal',
                target: al.nowa,
                name: al.nama,
                message: pesanTemplate.replace(/\[Nama\]/g, al.nama).replace(/\[Angkatan\]/g, al.angkatan || '')
            });
        }
    }

    // Antrean grup
    for (let jid of selectedGroups) {
        const gr = window.waGroups.find(g => g.jid === jid);
        queue.push({
            type: 'group',
            target: jid,
            name: gr ? gr.nama_grup : 'Grup WA',
            message: pesanTemplate.replace(/\[Nama\]/g, "Rekan-rekan").replace(/\[Angkatan\]/g, "")
        });
    }

    const totalTargets = queue.length;
    let successCount = 0; 
    let failedCount = 0;
    
    try {
        for (let i = 0; i < totalTargets; i++) {
            // Check cancellation
            if (window.broadcastCancelled) {
                statusText.innerText = 'Pengiriman dibatalkan!';
                break;
            }

            // Check pause state
            while (window.broadcastPaused && !window.broadcastCancelled) {
                statusText.innerText = 'Pengiriman dijeda...';
                await new Promise(r => setTimeout(r, 500));
            }

            if (window.broadcastCancelled) {
                statusText.innerText = 'Pengiriman dibatalkan!';
                break;
            }

            const item = queue[i];

            // Hitung & jalankan jeda acak (kecuali pesan pertama)
            if (i > 0) {
                const randomSec = Math.random() * (maxDelay - minDelay) + minDelay;
                const totalMs = randomSec * 1000;
                const steps = Math.ceil(totalMs / 200); // update status jeda setiap 200ms
                
                for (let step = steps; step > 0; step--) {
                    if (window.broadcastCancelled) break;
                    while (window.broadcastPaused && !window.broadcastCancelled) {
                        statusText.innerText = 'Pengiriman dijeda...';
                        await new Promise(r => setTimeout(r, 500));
                    }
                    const remainingSec = ((step * 200) / 1000).toFixed(1);
                    statusText.innerText = `Menunggu jeda aman... (${remainingSec}s)`;
                    await new Promise(r => setTimeout(r, 200));
                }
            }

            if (window.broadcastCancelled) {
                statusText.innerText = 'Pengiriman dibatalkan!';
                break;
            }

            // Mulai mengirim
            statusText.innerText = `Mengirim ke ${item.name}...`;
            try {
                // Jangan normalisasi format untuk JID grup (@g.us)
                const cleanPhone = item.type === 'personal' ? window.normalizePhoneNumber(item.target) : item.target;
                
                await window.sendWhatsAppInternal(cleanPhone, item.message, fileUrl, 'broadcast');
                successCount++;
            } catch(e) {
                failedCount++;
                console.error(`Gagal mengirim ke ${item.name}:`, e);
            }

            // Update Progress Bar
            const progressPercentage = Math.round(((i + 1) / totalTargets) * 100);
            progressBar.style.width = `${progressPercentage}%`;
            percentageText.innerText = `${progressPercentage}%`;
        }

        if (window.broadcastCancelled) {
            window.notify(`Broadcast Dibatalkan! Sukses: ${successCount}, Gagal: ${failedCount}`, 'warning');
        } else {
            statusText.innerText = 'Semua pesan terkirim!';
            window.notify(`Broadcast Selesai! Sukses: ${successCount}, Gagal: ${failedCount}`, 'success');
            setTimeout(() => { window.closeModal('modal-broadcast'); }, 1500);
        }

    } catch (err) { 
        window.notify('Terjadi kesalahan: ' + err.message, 'error'); 
        console.error(err); 
        statusText.innerText = 'Terjadi kesalahan!';
    } finally {
        inputFields.forEach(el => { if (el) el.disabled = false; });
        setTimeout(() => { progressContainer.classList.add('hidden'); }, 3000);
    }
};

window.sendLaporanKeuanganWA = async () => {
    const pesan = document.getElementById('laporan-msg-input').value;
    const format = document.getElementById('laporan-format-select').value;
    
    // Ambil semua target yang dicentang
    const checkedBoxes = document.querySelectorAll('input[name="laporan-target-check"]:checked');
    const selectedTargets = Array.from(checkedBoxes).map(cb => cb.value);
    
    if(selectedTargets.length === 0) return window.notify('Silakan pilih minimal satu grup/channel tujuan!', 'error');
    if(!pesan.trim()) return window.notify('Pesan pengantar tidak boleh kosong!', 'error');

    window.closeModal('modal-laporan-wa');
    window.toggleLoading(true, 'Mendeteksi server WhatsApp...');
    
    try {
        // Cek dulu apakah lokal API aktif
        const config = await window.getWaApiConfig();
        const localUrl = (config.local_api_url || '').trim();
        let isLocalActive = false;
        if (localUrl) {
            try {
                let cleanLocalUrl = localUrl;
                let localApiKey = '';
                if (cleanLocalUrl.includes('|')) {
                    const parts = cleanLocalUrl.split('|');
                    cleanLocalUrl = parts[0].trim();
                    localApiKey = parts[1].trim();
                }
                if (cleanLocalUrl.endsWith('/')) {
                    cleanLocalUrl = cleanLocalUrl.slice(0, -1);
                }
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 2000);
                
                const statusHeaders = { 'ngrok-skip-browser-warning': 'true' };
                if (localApiKey) {
                    statusHeaders['Authorization'] = `Bearer ${localApiKey}`;
                }
                const statusRes = await fetch(`${cleanLocalUrl}/api/status`, { 
                    headers: statusHeaders,
                    signal: controller.signal 
                });
                clearTimeout(timeoutId);
                const statusData = await statusRes.json();
                if (statusData && statusData.status === 'open') {
                    isLocalActive = true;
                }
            } catch (e) {
                console.warn("[WA] Gagal mendeteksi status bot lokal:", e.message);
            }
        }

        const generatedFiles = {};
        const getFilePayload = async (targetFormat) => {
            if (generatedFiles[targetFormat]) {
                return generatedFiles[targetFormat];
            }
            
            window.toggleLoading(true, `Men-generate file Laporan (${targetFormat.toUpperCase()})...`);
            const { fileBlob, fileName } = await window.generateLaporanFile(targetFormat);
            
            let fileUrl = null;
            if (fileBlob) {
                const CapCore = window.capacitorExports ? window.capacitorExports.Capacitor : window.Capacitor;
                if (CapCore && CapCore.Plugins && CapCore.Plugins.Filesystem) {
                    const Filesystem = CapCore.Plugins.Filesystem;
                    
                    // Konversi blob ke base64
                    const reader = new FileReader();
                    const base64Promise = new Promise((resolve, reject) => {
                        reader.onloadend = () => {
                            const base64 = reader.result.split(',')[1];
                            resolve(base64);
                        };
                        reader.onerror = reject;
                    });
                    reader.readAsDataURL(fileBlob);
                    const base64Data = await base64Promise;
                    
                    // Tulis file ke CACHE
                    const writeResult = await Filesystem.writeFile({
                        path: fileName,
                        data: base64Data,
                        directory: "CACHE",
                        recursive: true
                    });
                    
                    fileUrl = writeResult.uri;
                    console.log(`[sendLaporanKeuanganWA] Saved to local file URI (${targetFormat}):`, fileUrl);
                } else if (isLocalActive) {
                    // Jika bot lokal aktif: gunakan Base64 data URI secara langsung tanpa Cloudinary!
                    const reader = new FileReader();
                    const base64Promise = new Promise((resolve) => {
                        reader.onloadend = () => resolve(reader.result);
                    });
                    reader.readAsDataURL(fileBlob);
                    fileUrl = await base64Promise;
                    console.log(`[sendLaporanKeuanganWA] Menggunakan data base64 URI langsung untuk bot lokal (${targetFormat}).`);
                } else {
                    // Fallback ke Cloudinary jika bot lokal offline/tidak diset
                    window.toggleLoading(true, `Mengunggah Laporan (${targetFormat.toUpperCase()}) ke Cloud...`);
                    const isPdf = (targetFormat === 'pdf');
                    const uploadUrl = isPdf 
                        ? "https://api.cloudinary.com/v1_1/dowih3wr7/raw/upload" 
                        : "https://api.cloudinary.com/v1_1/dowih3wr7/auto/upload";

                    const formData = new FormData();
                    formData.append("file", fileBlob, fileName);
                    formData.append("upload_preset", "Reuniakbar"); 
                    const cloudRes = await fetch(uploadUrl, { method: "POST", body: formData });
                    const cloudData = await cloudRes.json();
                    if(cloudData.secure_url) {
                        fileUrl = cloudData.secure_url;
                    } else {
                        console.warn(`Cloudinary upload failed for ${targetFormat}`);
                    }
                }
            }
            generatedFiles[targetFormat] = fileUrl;
            return fileUrl;
        };

        // Loop kirim laporan ke setiap target yang dipilih dengan jeda random
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < selectedTargets.length; i++) {
            const targetJid = selectedTargets[i];
            const isChannel = targetJid.endsWith('@newsletter');
            
            // Jeda random antara 3 - 7 detik sebelum kirim ke target berikutnya (dimulai dari target ke-2)
            if (i > 0) {
                const randomDelay = Math.floor(Math.random() * (7000 - 3000 + 1)) + 3000;
                let countdown = Math.round(randomDelay / 1000);
                while (countdown > 0) {
                    window.toggleLoading(true, `Menunggu jeda aman agar terhindar dari spam... (${countdown}s)`);
                    await sleep(1000);
                    countdown--;
                }
            }
            
            // Tentukan format untuk target ini (Jika target adalah saluran/channel dan format terpilih adalah pdf, otomatis konversi/gunakan png)
            let targetFormat = format;
            if (isChannel && format === 'pdf') {
                targetFormat = 'png';
                console.log(`[sendLaporanKeuanganWA] Saluran/Channel (${targetJid}) tidak mendukung PDF. Mengonversi format laporan menjadi PNG secara otomatis.`);
            }

            // Dapatkan fileUrl untuk format target ini secara lazy
            const fileUrl = await getFilePayload(targetFormat);
            
            window.toggleLoading(true, `Mengirim Laporan ke target ${i + 1} dari ${selectedTargets.length}...`);
            try {
                await window.sendWhatsAppInternal(targetJid, pesan, fileUrl, 'finance', targetFormat);
                successCount++;
            } catch(sendErr) {
                console.error(`Gagal mengirim laporan ke target ${targetJid}:`, sendErr);
                failCount++;
            }
        }
        
        if (failCount === 0) {
            window.notify(`Laporan Keuangan berhasil dikirim ke ${successCount} grup/channel!`, 'success');
        } else {
            window.notify(`Kirim laporan selesai: ${successCount} berhasil, ${failCount} gagal.`, 'warning');
        }
    } catch(err) {
        window.notify('Gagal memproses Laporan: ' + err.message, 'error');
        console.error(err);
    }
    
    window.toggleLoading(false);
};

window.sendReceiptNotification = async (financeData) => {
    // No-op: Kuitansi resmi berupa gambar (PNG) dan teks notifikasi 
    // dikirimkan secara otomatis dari sisi server menggunakan Firestore listener
    console.log("[Client WA] sendReceiptNotification bypassed. Handled by server listener.");
};

// Manajemen Grup WA
window.handleWaGroupSubmit = async (e) => {
    e.preventDefault();
    const idEl = document.getElementById('set-wagroup-id') || document.getElementById('set-wagroup-id-tab');
    const nameEl = document.getElementById('set-wagroup-name') || document.getElementById('set-wagroup-name-tab');
    const jidEl = document.getElementById('set-wagroup-jid') || document.getElementById('set-wagroup-jid-tab');
    
    if (!idEl || !nameEl || !jidEl) return;
    const id = idEl.value || 'group_' + Date.now();
    const name = nameEl.value;
    const jid = jidEl.value;
    if(!jid.endsWith('@g.us') && !jid.endsWith('@newsletter')) return window.notify('ID JID harus berakhiran @g.us atau @newsletter', 'error');

    window.toggleLoading(true, 'Menyimpan Grup...');
    try {
        const localGroups = JSON.parse(localStorage.getItem('wa_registered_groups')) || [];
        const existingIdx = localGroups.findIndex(g => g.id === id);
        const newGroup = { id, nama_grup: name, jid, updated_at: Date.now() };
        
        if (existingIdx > -1) {
            localGroups[existingIdx] = newGroup;
        } else {
            localGroups.push(newGroup);
        }
        localStorage.setItem('wa_registered_groups', JSON.stringify(localGroups));
        
        window.notify('Grup Berhasil Disimpan!', 'success');
        idEl.value = ''; 
        e.target.reset();
        window.loadWaGroups();
    } catch(err) { window.notify('Gagal menyimpan: ' + err.message, 'error'); }
    window.toggleLoading(false);
};

window.loadWaGroups = async () => {
    try {
        const localGroups = JSON.parse(localStorage.getItem('wa_registered_groups')) || [];
        window.waGroups = localGroups;
        
        // Separate groups (@g.us) and channels (@newsletter)
        const groupsData = localGroups.filter(g => (g.jid || '').endsWith('@g.us'));
        const channelsData = localGroups.filter(g => (g.jid || '').endsWith('@newsletter'));

        // Update counts if indicators exist
        const groupsCountEl = document.getElementById('registered-groups-count');
        const channelsCountEl = document.getElementById('registered-channels-count');
        if (groupsCountEl) groupsCountEl.innerText = groupsData.length;
        if (channelsCountEl) channelsCountEl.innerText = channelsData.length;

        // Render Groups
        const groupsList = document.getElementById('wa-groups-list');
        if (groupsList) {
            groupsList.innerHTML = '';
            if (groupsData.length === 0) {
                groupsList.innerHTML = '<p class="text-xs text-slate-500 text-center italic py-4">Belum ada grup terdaftar.</p>';
            } else {
                const template = document.getElementById('tpl-wa-group');
                groupsData.forEach(data => {
                    const clone = template.content.cloneNode(true);
                    clone.querySelector('.tpl-name').textContent = data.nama_grup;
                    clone.querySelector('.tpl-jid').textContent = data.jid;
                    
                    const btnDelete = clone.querySelector('.tpl-btn-delete');
                    btnDelete.onclick = () => deleteWaGroup(data.id);
                    
                    groupsList.appendChild(clone);
                });
            }
        }

        // Render Channels
        const channelsList = document.getElementById('wa-channels-list');
        if (channelsList) {
            channelsList.innerHTML = '';
            if (channelsData.length === 0) {
                channelsList.innerHTML = '<p class="text-xs text-slate-500 text-center italic py-4">Belum ada saluran terdaftar.</p>';
            } else {
                const template = document.getElementById('tpl-wa-group');
                channelsData.forEach(data => {
                    const clone = template.content.cloneNode(true);
                    const nameEl = clone.querySelector('.tpl-name');
                    nameEl.textContent = data.nama_grup;
                    nameEl.className = 'text-xs font-bold text-purple-400 tpl-name';
                    clone.querySelector('.tpl-jid').textContent = data.jid;
                    
                    const btnDelete = clone.querySelector('.tpl-btn-delete');
                    btnDelete.onclick = () => deleteWaGroup(data.id);
                    
                    channelsList.appendChild(clone);
                });
            }
        }
        
        const groupSelect = document.getElementById('laporan-grup-select');
        if(groupSelect) {
            groupSelect.innerHTML = '<option value="">-- Pilih Grup WA --</option>' + window.waGroups.map(g => `<option value="${window.escapeHtml(g.jid)}">${window.escapeHtml(g.nama_grup)}</option>`).join('');
        }

        // Populate select-wa-group-auto dropdown
        const autoSelect = document.getElementById("select-wa-group-auto");
        if (autoSelect) {
            autoSelect.innerHTML = '<option value="">-- Pilih Grup / Channel --</option>' +
                localGroups.map(g => {
                    const isChannel = (g.jid || '').endsWith('@newsletter');
                    const prefix = isChannel ? '[Channel] ' : '[Grup] ';
                    return `<option value="${g.jid}" data-name="${g.nama_grup || g.name || ''}">${prefix}${g.nama_grup || g.name || ''}</option>`;
                }).join('');
        }

        // Populate select-wa-approval-group-auto, select-wa-group-pendataan-auto, and select-wa-group-log-auto dropdowns
        const groupsOnly = localGroups.filter(g => (g.jid || '').endsWith('@g.us'));

        const approvalJid = document.getElementById("set-wa-approval-group-jid") ? document.getElementById("set-wa-approval-group-jid").value.trim() : "";
        const pendataanJid = document.getElementById("set-wa-group-pendataan-jid") ? document.getElementById("set-wa-group-pendataan-jid").value.trim() : "";
        const logJid = document.getElementById("set-wa-group-log-jid") ? document.getElementById("set-wa-group-log-jid").value.trim() : "";

        window.populateSelectWithSaved(document.getElementById("select-wa-approval-group-auto"), approvalJid, groupsOnly);
        window.populateSelectWithSaved(document.getElementById("select-wa-group-pendataan-auto"), pendataanJid, groupsOnly);
        window.populateSelectWithSaved(document.getElementById("select-wa-group-log-auto"), logJid, groupsOnly);
    } catch(err) { console.error("Gagal load WA Groups", err); }
};

window.deleteWaGroup = async (id) => {
    if(!confirm('Hapus grup ini?')) return;
    try {
        let localGroups = JSON.parse(localStorage.getItem('wa_registered_groups')) || [];
        localGroups = localGroups.filter(g => g.id !== id);
        localStorage.setItem('wa_registered_groups', JSON.stringify(localGroups));
        window.loadWaGroups();
    } catch(e) {
        window.notify('Gagal menghapus grup', 'error');
    }
};

window.openGroupManagement = () => { window.closeModal('modal-broadcast'); window.showTab('wa-groups'); };

window.switchGroupTab = (tab) => {
    const tabRegistered = document.getElementById('tab-btn-registered') || document.getElementById('tab-btn-registered-tab');
    const tabSync = document.getElementById('tab-btn-sync') || document.getElementById('tab-btn-sync-tab');
    const contentRegistered = document.getElementById('tab-content-registered') || document.getElementById('tab-content-registered-tab');
    const contentSync = document.getElementById('tab-content-sync') || document.getElementById('tab-content-sync-tab');

    if (!tabRegistered || !tabSync || !contentRegistered || !contentSync) return;

    if (tab === 'registered') {
        tabRegistered.className = "flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer bg-indigo-600 text-white shadow-md";
        tabSync.className = "flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer text-slate-400 hover:text-slate-200";
        contentRegistered.classList.remove('hidden');
        contentSync.classList.add('hidden');
    } else {
        tabSync.className = "flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer bg-indigo-600 text-white shadow-md";
        tabRegistered.className = "flex-1 py-2 text-center text-xs font-bold rounded-xl transition-all cursor-pointer text-slate-400 hover:text-slate-200";
        contentSync.classList.remove('hidden');
        contentRegistered.classList.add('hidden');
    }
};

window.fetchGroupsFromWA = async () => {
    const listContainer = document.getElementById('wa-sync-groups-list') || document.getElementById('wa-sync-groups-list-tab');
    const btnImport = document.getElementById('btn-import-wa-groups') || document.getElementById('btn-import-wa-groups-tab');
    const btnSelectAll = document.getElementById('btn-select-all-sync') || document.getElementById('btn-select-all-sync-tab');
    
    if (listContainer) {
        listContainer.innerHTML = '<div class="flex flex-col items-center justify-center py-12 text-center text-slate-500 gap-3"><div style="width:28px; height:28px; border:3px solid #10B981; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div><p class="text-xs italic text-slate-400">Mengambil grup dari WhatsApp...</p></div>';
    }
    const searchInput = document.getElementById('wa-groups-search') || document.getElementById('wa-groups-search-tab');
    if (searchInput) searchInput.value = '';
    const searchContainer = document.getElementById('wa-groups-search-container') || document.getElementById('wa-groups-search-container-tab');
    if (searchContainer) searchContainer.classList.add('hidden');

    if (btnImport) btnImport.classList.add('hidden');
    if (btnSelectAll) btnSelectAll.classList.add('hidden');
    
    // 1. JIKA DI LINGKUNGAN APLIKASI (Capacitor NodeJS)
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins.CapacitorNodeJS) {
        window.Capacitor.Plugins.CapacitorNodeJS.send({
            eventName: 'get_groups',
            args: [{ sessionId: window.currentWaSessionId }]
        });
        return;
    }

    // 2. JIKA DI LINGKUNGAN WEB (Browser)
    try {
        const config = await window.getWaApiConfig();
        if (!config || Object.keys(config).length === 0) {
            throw new Error('Pengaturan API WA belum diset.');
        }
        const localUrl = (config.local_api_url || '').trim();
        
        // Priority 1: WhatsApp Local API
        if (localUrl) {
            let cleanLocalUrl = localUrl;
            let localApiKey = '';
            if (cleanLocalUrl.includes('|')) {
                const parts = cleanLocalUrl.split('|');
                cleanLocalUrl = parts[0].trim();
                localApiKey = parts[1].trim();
            }
            if (cleanLocalUrl.endsWith('/')) {
                cleanLocalUrl = cleanLocalUrl.slice(0, -1);
            }
            console.log('[WA] Mengambil daftar grup dari server lokal...');
            const headers = { 'ngrok-skip-browser-warning': 'true' };
            if (localApiKey) {
                headers['Authorization'] = `Bearer ${localApiKey}`;
            }
            const response = await fetch(`${cleanLocalUrl}/api/groups`, { headers });
            const resData = await response.json();
            if (resData.success) {
                const groups = (resData.groups || []).map(g => ({
                    jid: g.jid,
                    name: g.name || 'Grup Tanpa Nama'
                }));
                window.handleGroupsFetchedOnWeb(groups);
                window.notify(`Berhasil memuat ${groups.length} grup!`, 'success');
                return;
            } else {
                console.warn('[WA] Gagal fetch dari local API, beralih ke provider online...', resData.error);
            }
        }
        
        // Priority 2: Online Provider (Fonnte)
        const provider = config.provider_broadcast || 'fonnte';
        const token = config.token_broadcast || '';

        if (provider === 'fonnte') {
            console.log('[WA] Mengambil daftar grup dari Fonnte...');
            try {
                await fetch('https://api.fonnte.com/fetch-group', {
                    method: 'POST',
                    headers: { 'Authorization': token.trim() }
                });
            } catch (e) {
                console.warn('[WA] Gagal sinkronisasi awal fetch-group Fonnte:', e);
            }

            const response = await fetch('https://api.fonnte.com/get-whatsapp-group', {
                method: 'POST',
                headers: { 'Authorization': token.trim() }
            });
            const resData = await response.json();
            
            if (resData.status === true || resData.status === 'true') {
                const groups = (resData.data || []).map(g => ({
                    jid: g.id,
                    name: g.name || 'Grup Tanpa Nama'
                }));
                window.handleGroupsFetchedOnWeb(groups);
            } else {
                throw new Error(resData.reason || resData.message || 'Gagal mengambil grup dari Fonnte.');
            }
        } else {
            throw new Error(`Koneksi grup otomatis hanya didukung untuk API Lokal dan Fonnte.`);
        }
    } catch (err) {
        console.error(err);
        if (listContainer) {
            listContainer.innerHTML = `<p class="text-xs text-red-400 text-center italic py-8">Gagal memuat grup: ${window.escapeHtml(err.message)}</p>`;
        }
        window.notify('Gagal mengambil grup: ' + err.message, 'error');
    }
};

window.fetchChannelsFromWA = async () => {
    const listContainer = document.getElementById('wa-sync-groups-list') || document.getElementById('wa-sync-groups-list-tab');
    const btnImport = document.getElementById('btn-import-wa-groups') || document.getElementById('btn-import-wa-groups-tab');
    const btnSelectAll = document.getElementById('btn-select-all-sync') || document.getElementById('btn-select-all-sync-tab');
    
    if (listContainer) {
        listContainer.innerHTML = '<div class="flex flex-col items-center justify-center py-12 text-center text-slate-500 gap-3"><div style="width:28px; height:28px; border:3px solid #8B5CF6; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div><p class="text-xs italic text-slate-400">Mengambil channel diikuti dari WhatsApp...</p></div>';
    }
    const searchInput = document.getElementById('wa-groups-search') || document.getElementById('wa-groups-search-tab');
    if (searchInput) searchInput.value = '';
    const searchContainer = document.getElementById('wa-groups-search-container') || document.getElementById('wa-groups-search-container-tab');
    if (searchContainer) searchContainer.classList.add('hidden');

    if (btnImport) btnImport.classList.add('hidden');
    if (btnSelectAll) btnSelectAll.classList.add('hidden');
    
    try {
        const config = await window.getWaApiConfig();
        if (!config || Object.keys(config).length === 0) {
            throw new Error('Pengaturan API WA belum diset.');
        }
        const localUrl = (config.local_api_url || '').trim();
        
        if (!localUrl) {
            throw new Error('Fitur sinkronisasi channel memerlukan API WhatsApp Lokal terhubung.');
        }

        let cleanLocalUrl = localUrl;
        let localApiKey = '';
        if (cleanLocalUrl.includes('|')) {
            const parts = cleanLocalUrl.split('|');
            cleanLocalUrl = parts[0].trim();
            localApiKey = parts[1].trim();
        }
        if (cleanLocalUrl.endsWith('/')) {
            cleanLocalUrl = cleanLocalUrl.slice(0, -1);
        }
        
        console.log('[WA] Mengambil daftar channel dari server lokal...');
        const headers = { 'ngrok-skip-browser-warning': 'true' };
        if (localApiKey) {
            headers['Authorization'] = `Bearer ${localApiKey}`;
        }
        const response = await fetch(`${cleanLocalUrl}/api/channels`, { headers });
        const resData = await response.json();
        
        if (resData.success) {
            const channels = (resData.channels || []).map(c => ({
                jid: c.jid,
                name: c.name || 'Channel Tanpa Nama',
                role: c.role || 'follower'
            }));
            
            window.handleGroupsFetchedOnWeb(channels);
            window.notify(`Berhasil memuat ${channels.length} channel!`, 'success');
        } else {
            throw new Error(resData.error || 'Gagal mengambil channel dari server.');
        }
    } catch (err) {
        console.error(err);
        if (listContainer) {
            listContainer.innerHTML = `<p class="text-xs text-red-400 text-center italic py-8">Gagal memuat channel: ${window.escapeHtml(err.message)}</p>`;
        }
        window.notify('Gagal mengambil channel: ' + err.message, 'error');
    }
};

window.handleGroupsFetchedOnWeb = (groups) => {
    window.toggleLoading(false);
    const listContainer = document.getElementById('wa-sync-groups-list') || document.getElementById('wa-sync-groups-list-tab');
    const btnImport = document.getElementById('btn-import-wa-groups') || document.getElementById('btn-import-wa-groups-tab');
    const btnSelectAll = document.getElementById('btn-select-all-sync') || document.getElementById('btn-select-all-sync-tab');
    
    if (!listContainer) return;
    
    if (groups.length === 0) {
        listContainer.innerHTML = '<p class="text-xs text-slate-500 text-center italic py-8">Tidak ditemukan grup pada WhatsApp ini.</p>';
        if (btnImport) btnImport.classList.add('hidden');
        if (btnSelectAll) btnSelectAll.classList.add('hidden');
        return;
    }
    
    window.fetchedWaGroups = groups;
    
    const searchContainer = document.getElementById('wa-groups-search-container') || document.getElementById('wa-groups-search-container-tab');
    if (searchContainer) searchContainer.classList.remove('hidden');
    
    window.renderWaGroupsList(groups);
    
    if (btnImport) {
        btnImport.classList.remove('hidden');
        const countEl = document.getElementById('selected-sync-count') || document.getElementById('selected-sync-count-tab');
        if (countEl) countEl.innerText = '0';
    }
    if (btnSelectAll) {
        btnSelectAll.classList.remove('hidden');
        btnSelectAll.innerText = 'Pilih Semua';
    }
};

window.updateSelectedSyncCount = () => {
    const checkboxes = document.querySelectorAll('.sync-group-checkbox:checked');
    const totalCheckboxes = document.querySelectorAll('.sync-group-checkbox');
    const btnSelectAll = document.getElementById('btn-select-all-sync') || document.getElementById('btn-select-all-sync-tab');
    const countEl = document.getElementById('selected-sync-count') || document.getElementById('selected-sync-count-tab');
    
    if (countEl) countEl.innerText = checkboxes.length;
    
    if (btnSelectAll) {
        if (checkboxes.length === totalCheckboxes.length && totalCheckboxes.length > 0) {
            btnSelectAll.innerText = 'Batal Pilih Semua';
        } else {
            btnSelectAll.innerText = 'Pilih Semua';
        }
    }
};

window.toggleSelectAllSyncGroups = () => {
    const checkboxes = document.querySelectorAll('.sync-group-checkbox');
    const checkedBoxes = document.querySelectorAll('.sync-group-checkbox:checked');
    const shouldSelectAll = checkedBoxes.length < checkboxes.length;
    
    checkboxes.forEach(cb => {
        cb.checked = shouldSelectAll;
    });
    
    window.updateSelectedSyncCount();
};

window.importSelectedWaGroups = async () => {
    const checkboxes = document.querySelectorAll('.sync-group-checkbox:checked');
    if (checkboxes.length === 0) return window.notify('Pilih minimal 1 grup untuk diimpor!', 'error');

    window.toggleLoading(true, 'Mengimpor Grup...');
    let imported = 0;
    try {
        const localGroups = JSON.parse(localStorage.getItem('wa_registered_groups')) || [];
        for (let cb of checkboxes) {
            const jid = cb.value;
            const name = cb.dataset.name;

            const existingIdx = localGroups.findIndex(g => g.jid === jid);
            const docId = existingIdx > -1 ? localGroups[existingIdx].id : 'group_' + Math.random().toString(36).substr(2, 9);
            const newGroup = { id: docId, nama_grup: name, jid: jid, updated_at: Date.now() };

            if (existingIdx > -1) {
                localGroups[existingIdx] = newGroup;
            } else {
                localGroups.push(newGroup);
            }
            imported++;
        }
        localStorage.setItem('wa_registered_groups', JSON.stringify(localGroups));
        window.notify(`Berhasil mengimpor ${imported} grup!`, 'success');
        window.switchGroupTab('registered');
        await window.loadWaGroups();
    } catch(err) {
        window.notify('Gagal mengimpor grup: ' + err.message, 'error');
        console.error(err);
    } finally {
        window.toggleLoading(false);
    }
};

window.renderWaGroupsList = (groups) => {
    const listContainer = document.getElementById('wa-sync-groups-list') || document.getElementById('wa-sync-groups-list-tab');
    if (!listContainer) return;
    
    if (groups.length === 0) {
        listContainer.innerHTML = '<p class="text-xs text-slate-500 text-center italic py-8">Grup tidak ditemukan.</p>';
        return;
    }
    
    listContainer.innerHTML = groups.map(g => `
        <div class="bg-black/20 p-3 rounded-xl border border-white/5 flex justify-between items-center mb-2">
            <div class="flex-1 pr-3">
                <h5 class="text-xs font-bold text-slate-300">${window.escapeHtml(g.name)}</h5>
                <p class="text-[10px] text-slate-400 mt-1"><i class="fas fa-hashtag mr-1"></i> ${window.escapeHtml(g.jid)}</p>
            </div>
            <div class="flex items-center">
                <input type="checkbox" value="${window.escapeHtml(g.jid)}" data-name="${window.escapeHtml(g.name)}" class="sync-group-checkbox w-4 h-4 rounded border-white/10 bg-black/20 text-indigo-500 focus:ring-indigo-500" onchange="window.updateSelectedSyncCount()">
            </div>
        </div>
    `).join('');
};

window.filterWaGroups = () => {
    const searchInput = document.getElementById('wa-groups-search') || document.getElementById('wa-groups-search-tab');
    const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
    if (!window.fetchedWaGroups) return;
    
    const filtered = window.fetchedWaGroups.filter(g => 
        (g.name || '').toLowerCase().includes(query) || (g.jid || '').toLowerCase().includes(query)
    );
    window.renderWaGroupsList(filtered);
};

// Event Listener NodeJS Channel
function initWhatsAppEngine() {
    window.loadWaGroups();
    if (window.initWaReceiptToggle) window.initWaReceiptToggle();
    if (window.initCampaignScheduler) window.initCampaignScheduler();
    
    // Setup NodeJS Channel Listeners
    if (!window.Capacitor || !window.Capacitor.Plugins || !window.Capacitor.Plugins.CapacitorNodeJS) {
        console.log('[WA] Not running in Capacitor, skip NodeJS setup. Enabling Web API Mode UI.');
        
        // Switch UI to Web API mode
        const nodejsContainer = document.getElementById('wa-nodejs-container');
        const webApiContainer = document.getElementById('wa-web-api-container');
        const nodeStatus = document.getElementById('wa-node-status');
        const connectionStatus = document.getElementById('wa-connection-status');
        
        if (nodejsContainer) {
            nodejsContainer.classList.add('hidden');
            console.log('[WA] Hidden NodeJS container successfully.');
        } else {
            console.log('[WA] NodeJS container element not found!');
        }
        
        if (webApiContainer) {
            webApiContainer.classList.remove('hidden');
            console.log('[WA] Revealed Web API container successfully.');
            if (typeof window.openWASettingsWeb === 'function') {
                window.openWASettingsWeb();
            }
        } else {
            console.log('[WA] Web API container element not found!');
        }
        
        if (nodeStatus) {
            nodeStatus.classList.add('hidden');
        }
        if (connectionStatus) {
            connectionStatus.classList.add('hidden');
        }
        const localStatusEl = document.getElementById('wa-local-api-status');
        if (localStatusEl) {
            localStatusEl.classList.remove('hidden');
        }
        
        // Move wa-link-card to the top of wa-web-right-col for web access
        const linkCard = document.getElementById('wa-link-card');
        const webRightCol = document.getElementById('wa-web-right-col');
        if (linkCard && webRightCol) {
            webRightCol.insertBefore(linkCard, webRightCol.firstChild);
        }
        return;
    }

    const nodejs = window.Capacitor.Plugins.CapacitorNodeJS;

    // Query current WhatsApp connection status will be called after nodejs.start() resolves

    // ---- Helper: update MD3 status chip ----
    function setWaConnectionStatus(isOnline) {
        const el = document.getElementById('wa-connection-status');
        if (!el) return;
        if (isOnline) {
            el.style.borderColor = '#25D366';
            el.innerHTML = '<i class="fab fa-whatsapp" style="color:#25D366; font-size:10px;"></i><span style="color:#25D366; font-size:10px; font-weight:500;">ONLINE</span>';
        } else {
            el.style.borderColor = '#49454F';
            el.innerHTML = '<i class="fab fa-whatsapp" style="color:#CAC4D0; font-size:10px;"></i><span style="color:#CAC4D0; font-size:10px; font-weight:500;">OFFLINE</span>';
        }
    }

    // ---- Helper: show QR ----
    function showQRCode(qrText) {
        const qrCodeEl = document.getElementById('wa-qr-code');
        const loadingState = document.getElementById('wa-loading-state');
        const connectedState = document.getElementById('wa-connected-state');
        if (loadingState) loadingState.classList.add('hidden');
        if (connectedState) connectedState.classList.add('hidden');
        if (qrCodeEl) {
            qrCodeEl.classList.remove('hidden');
            qrCodeEl.innerHTML = '';
            if (typeof QRCode !== 'undefined') {
                new QRCode(qrCodeEl, {
                    text: qrText,
                    width: 176,
                    height: 176,
                    colorDark: "#111626",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            } else {
                qrCodeEl.innerHTML = '<p class="text-xs text-red-400">Library QRCode.js tidak tersedia</p>';
                console.error('[WA] QRCode library not found');
            }
        }
    }

    // ---- REGISTER LISTENERS FIRST (before start) ----

    function alignSessionId(eventSessionId) {
        if (eventSessionId && eventSessionId !== window.currentWaSessionId) {
            console.log(`[WA] Auto-sync session ID: frontend had ${window.currentWaSessionId}, backend reports ${eventSessionId}. Aligning...`);
            window.currentWaSessionId = eventSessionId;
            localStorage.setItem('wa_current_session', eventSessionId);
            const selectEl = document.getElementById('wa-session-select');
            if (selectEl) {
                selectEl.value = eventSessionId;
            }
        }
    }

    nodejs.addListener('qr_code', (data) => {
        const dataObj = data.args ? data.args[0] : data;
        alignSessionId(dataObj.sessionId);
        console.log('[WA] qr_code event received for session:', dataObj.sessionId);
        
        // Pastikan status NodeJS Siap diperbarui jika sebelumnya masih loading
        const nodeStatus = document.getElementById('wa-node-status');
        if (nodeStatus) {
            nodeStatus.style.borderColor = '#6750A4';
            nodeStatus.innerHTML = '<div style="width:6px;height:6px;border-radius:50%;background:#D0BCFF;"></div><span style="color:#D0BCFF; font-size:10px; font-weight:500;">NodeJS Siap</span>';
        }

        window.toggleLoading(false);
        showQRCode(dataObj.qr);
    });

    nodejs.addListener('ready', (data) => {
        console.log('[WA] NodeJS ready event received');
        const nodeStatus = document.getElementById('wa-node-status');
        if (nodeStatus) {
            nodeStatus.style.borderColor = '#6750A4';
            nodeStatus.innerHTML = '<div style="width:6px;height:6px;border-radius:50%;background:#D0BCFF;"></div><span style="color:#D0BCFF; font-size:10px; font-weight:500;">NodeJS Siap</span>';
        }
        
        // Sync active session on startup to align backend with frontend select box
        console.log('[WA] Syncing active session with backend:', window.currentWaSessionId);
        window.startWAServer();
    });

    nodejs.addListener('status_update', (data) => {
        const dataObj = data.args ? data.args[0] : data;
        alignSessionId(dataObj.sessionId);
        const status = dataObj.status || '';
        console.log('[WA] status_update for session', dataObj.sessionId, ':', status);

        // Pastikan status NodeJS Siap diperbarui jika sebelumnya masih loading
        const nodeStatus = document.getElementById('wa-node-status');
        if (nodeStatus) {
            nodeStatus.style.borderColor = '#6750A4';
            nodeStatus.innerHTML = '<div style="width:6px;height:6px;border-radius:50%;background:#D0BCFF;"></div><span style="color:#D0BCFF; font-size:10px; font-weight:500;">NodeJS Siap</span>';
        }

        const qrCodeEl = document.getElementById('wa-qr-code');
        const loadingState = document.getElementById('wa-loading-state');
        const connectedState = document.getElementById('wa-connected-state');

        if (status.includes('Connected')) {
            if (qrCodeEl) qrCodeEl.classList.add('hidden');
            if (loadingState) loadingState.classList.add('hidden');
            if (connectedState) connectedState.classList.remove('hidden');
            setWaConnectionStatus(true);
            window.isWaConnected = true;
            window.toggleLoading(false);
        } else if (status.includes('Connecting')) {
            if (qrCodeEl) qrCodeEl.classList.add('hidden');
            if (connectedState) connectedState.classList.add('hidden');
            if (loadingState) {
                loadingState.classList.remove('hidden');
                loadingState.innerHTML = '<div class="flex flex-col items-center justify-center gap-2"><div style="width:36px; height:36px; border:3px solid #6750A4; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div><p class="text-[9px] text-slate-400 font-bold tracking-widest uppercase text-center px-4">Menghubungkan...</p></div>';
            }
            window.isWaConnected = false;
        } else if (status.includes('Disconnected') || status.includes('resetting')) {
            if (qrCodeEl) qrCodeEl.classList.add('hidden');
            if (connectedState) connectedState.classList.add('hidden');
            if (loadingState) {
                loadingState.classList.remove('hidden');
                loadingState.innerHTML = '<i class="fas fa-exclamation-triangle text-amber-400 text-2xl mb-3"></i><p class="text-[9px] text-slate-400 font-bold tracking-widest uppercase text-center px-4">Terputus<br>Memuat ulang...</p>';
            }
            setWaConnectionStatus(false);
            window.isWaConnected = false;
        }
    });

    nodejs.addListener('groups_list', (data) => {
        const dataObj = data.args ? data.args[0] : data;
        alignSessionId(dataObj.sessionId);
        
        console.log('[WA-Frontend] groups_list received:', JSON.stringify(dataObj));
        window.toggleLoading(false);
        const listContainer = document.getElementById('wa-sync-groups-list');
        const btnImport = document.getElementById('btn-import-wa-groups');
        const btnSelectAll = document.getElementById('btn-select-all-sync');
        
        if (!listContainer) return;
        
        if (dataObj.ok) {
            const groups = dataObj.groups || [];
            if (groups.length === 0) {
                listContainer.innerHTML = '<p class="text-xs text-slate-500 text-center italic py-8">Tidak ditemukan grup pada WhatsApp ini.</p>';
                if (btnImport) btnImport.classList.add('hidden');
                if (btnSelectAll) btnSelectAll.classList.add('hidden');
                return;
            }
            
            // Simpan data grup secara global untuk pencarian
            window.fetchedWaGroups = groups;
            
            // Tampilkan container pencarian
            const searchContainer = document.getElementById('wa-groups-search-container');
            if (searchContainer) searchContainer.classList.remove('hidden');
            
            window.renderWaGroupsList(groups);
            
            if (btnImport) {
                btnImport.classList.remove('hidden');
                document.getElementById('selected-sync-count').innerText = '0';
            }
            if (btnSelectAll) {
                btnSelectAll.classList.remove('hidden');
                btnSelectAll.innerText = 'Pilih Semua';
            }
        } else {
            listContainer.innerHTML = `<p class="text-xs text-red-400 text-center italic py-8">Gagal memuat grup: ${window.escapeHtml(dataObj.error)}</p>`;
            if (btnImport) btnImport.classList.add('hidden');
            if (btnSelectAll) btnSelectAll.classList.add('hidden');
            window.notify('Gagal mengambil grup WA: ' + dataObj.error, 'error');
        }
    });

    nodejs.addListener('pairing_code', (data) => {
        const dataObj = data.args ? data.args[0] : data;
        alignSessionId(dataObj.sessionId);
        console.log('[WA] pairing_code received:', dataObj.code);
        window.toggleLoading(false);
        const display = document.getElementById('wa-pairing-code-display');
        const textCode = document.getElementById('wa-pairing-code-text');
        if (display && textCode) {
            display.classList.remove('hidden');
            let code = dataObj.code || '';
            if (code.length === 8) code = code.substring(0,4) + '-' + code.substring(4);
            textCode.innerText = code;
            window.notify('Kode tautan: ' + code, 'success');
        }
    });

    nodejs.addListener('export_result', (data) => {
        const dataObj = data.args ? data.args[0] : data;
        alignSessionId(dataObj.sessionId);
        window.toggleLoading(false);
        if (dataObj.ok) window.notify('Berhasil mengexport sesi ke Drive!', 'success');
        else window.notify('Gagal mengexport: ' + dataObj.error, 'error');
    });

    nodejs.addListener('import_result', (data) => {
        const dataObj = data.args ? data.args[0] : data;
        alignSessionId(dataObj.sessionId);
        window.toggleLoading(false);
        if (dataObj.ok) window.notify('Berhasil mengimport sesi. Menunggu restart...', 'success');
        else window.notify('Gagal mengimport: ' + dataObj.error, 'error');
    });

    nodejs.addListener('reset_result', (data) => {
        const dataObj = data.args ? data.args[0] : data;
        alignSessionId(dataObj.sessionId);
        if (dataObj.ok) {
            window.notify('Sesi berhasil direset!', 'success');
            const qrCodeEl = document.getElementById('wa-qr-code');
            const loadingState = document.getElementById('wa-loading-state');
            const connectedState = document.getElementById('wa-connected-state');
            if (qrCodeEl) qrCodeEl.classList.add('hidden');
            if (connectedState) connectedState.classList.add('hidden');
            if (loadingState) {
                loadingState.classList.remove('hidden');
                loadingState.innerHTML = '<i class="fas fa-robot text-slate-400 text-3xl mb-3"></i><p class="text-[9px] text-slate-400 font-bold tracking-widest uppercase text-center px-4">Sesi Dihapus</p>';
            }
            setWaConnectionStatus(false);
        } else {
            window.notify('Gagal mereset sesi: ' + dataObj.error, 'error');
        }
    });

    nodejs.addListener('error', (data) => {
        const dataObj = data.args ? data.args[0] : data;
        alignSessionId(dataObj.sessionId);
        console.error('[WA] Error from NodeJS:', dataObj.error);
        window.toggleLoading(false);
        window.notify('WhatsApp Error: ' + dataObj.error, 'error');
    });

    // ---- START NODEJS ENGINE ----
    console.log('[WA] Starting NodeJS engine...');
    nodejs.start().then(() => {
        console.log('[WA] NodeJS engine started successfully');
        console.log('[WA] Querying initial status for current session:', window.currentWaSessionId);
        nodejs.send({
            eventName: 'check_status',
            args: [{ sessionId: window.currentWaSessionId }]
        });
    }).catch(e => {
        console.error('[WA] NodeJS start error:', e);
        // Engine mungkin sudah berjalan, coba kirim check_status
        console.log('[WA] Querying initial status for current session:', window.currentWaSessionId);
        nodejs.send({
            eventName: 'check_status',
            args: [{ sessionId: window.currentWaSessionId }]
        });
    });
}

// ============================================================================
// FASE 12: KAMPANYE BROADCAST TERJADWAL & SINKRONISASI RUNNER TERDISTRIBUSI
// ============================================================================

window.switchWaLinkTab = (mode) => {
    const btnQr = document.getElementById('btn-wa-link-qr');
    const btnPhone = document.getElementById('btn-wa-link-phone');
    const panelQr = document.getElementById('panel-wa-link-qr');
    const panelPhone = document.getElementById('panel-wa-link-phone');
    
    if (!btnQr || !btnPhone || !panelQr || !panelPhone) return;
    
    if (mode === 'qr') {
        btnQr.className = 'flex-1 py-2.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all bg-indigo-600/30 text-indigo-400 border border-indigo-500/20';
        btnPhone.className = 'flex-1 py-2.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all text-slate-400 hover:text-white border border-transparent';
        panelQr.classList.remove('hidden');
        panelPhone.classList.add('hidden');
    } else {
        btnPhone.className = 'flex-1 py-2.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all bg-indigo-600/30 text-indigo-400 border border-indigo-500/20';
        btnQr.className = 'flex-1 py-2.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all text-slate-400 hover:text-white border border-transparent';
        panelQr.classList.add('hidden');
        panelPhone.classList.remove('hidden');
    }
};

window.toggleScheduleInput = (checked) => {
    const container = document.getElementById('broadcast-schedule-time-container');
    if (!container) return;
    if (checked) {
        container.classList.remove('hidden');
        const futureDate = new Date(Date.now() + 3600000);
        const tzoffset = futureDate.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(futureDate - tzoffset)).toISOString().slice(0, 16);
        document.getElementById('broadcast-schedule-time').value = localISOTime;
    } else {
        container.classList.add('hidden');
    }
};

window.submitBroadcast = async () => {
    const isScheduled = document.getElementById('broadcast-schedule-toggle').checked;
    if (isScheduled) {
        const scheduleTime = document.getElementById('broadcast-schedule-time').value;
        if (!scheduleTime) return window.notify('Pilih tanggal & waktu penjadwalan!', 'error');
        if (new Date(scheduleTime).getTime() <= Date.now()) return window.notify('Waktu jadwal harus di masa depan!', 'error');
        
        await window.createScheduledCampaign(scheduleTime);
    } else {
        await window.executeBroadcastWA();
    }
};

window.createScheduledCampaign = async (scheduleTime) => {
    const pesanTemplate = document.getElementById('broadcast-msg-input').value;
    if (!pesanTemplate.trim()) return window.notify('Pesan tidak boleh kosong!', 'error');

    const groupCheckboxes = document.querySelectorAll('.bc-group-checkbox:checked');
    const selectedGroups = Array.from(groupCheckboxes).map(cb => cb.value); 
    const selectedAlumniIds = window.selectedAlumni ? Array.from(window.selectedAlumni) : [];
    
    if (selectedAlumniIds.length === 0 && selectedGroups.length === 0) return window.notify('Pilih minimal 1 Alumni atau 1 Grup Target!', 'error');

    const delayVal = document.getElementById('broadcast-delay-select').value;
    
    window.toggleLoading(true, "Menjadwalkan Kampanye...");
    
    let fileUrl = null;
    const fileInput = document.getElementById('broadcast-file');
    try {
        if (fileInput && fileInput.files.length > 0) {
            window.toggleLoading(true, "Mengunggah Lampiran Digital...");
            const file = fileInput.files[0];
            const isPdf = file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
            const uploadUrl = isPdf 
                ? "https://api.cloudinary.com/v1_1/dowih3wr7/raw/upload" 
                : "https://api.cloudinary.com/v1_1/dowih3wr7/auto/upload";
                
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", "Reuniakbar"); 
            const cloudRes = await fetch(uploadUrl, { method: "POST", body: formData });
            const cloudData = await cloudRes.json();
            if (cloudData.secure_url) {
                fileUrl = cloudData.secure_url;
            } else {
                throw new Error("Gagal mendapatkan URL dari Cloudinary");
            }
        }

        const targets = [];
        selectedAlumniIds.forEach(id => {
            const al = window.STATE.alumni.find(a => a.id === id);
            if (al && al.nowa) {
                targets.push({
                    type: 'personal',
                    target: al.nowa,
                    name: al.nama,
                    angkatan: al.angkatan || ''
                });
            }
        });
        selectedGroups.forEach(jid => {
            const gr = window.waGroups.find(g => g.jid === jid);
            targets.push({
                type: 'group',
                target: jid,
                name: gr ? gr.nama_grup : 'Grup WA'
            });
        });

        const campaignData = {
            name: `Broadcast ${new Date(scheduleTime).toLocaleString('id-ID')}`,
            message: pesanTemplate,
            scheduled_at: new Date(scheduleTime).toISOString(),
            created_at: new Date().toISOString(),
            created_by: window.STATE.user ? window.STATE.user.email : "admin@reuni.com",
            targets: targets,
            status: "pending", 
            file_url: fileUrl,
            delay_val: delayVal,
            stats: { success: 0, failed: 0, total: targets.length }
        };

        await db.collection("wa_campaigns").add(campaignData);
        await window.logActivity("campaign_schedule", `Menjadwalkan kampanye WA "${campaignData.name}" untuk tanggal ${new Date(scheduleTime).toLocaleString('id-ID')} dengan total ${targets.length} target`);
        
        window.notify("Kampanye berhasil dijadwalkan!", "success");
        window.closeModal("modal-broadcast");
        
        document.getElementById('broadcast-msg-input').value = '';
        document.getElementById('broadcast-file').value = '';
        document.getElementById('broadcast-schedule-toggle').checked = false;
        window.toggleScheduleInput(false);

        window.renderCampaignsTable();
    } catch(err) {
        console.error("Gagal menjadwalkan campaign:", err);
        window.notify("Gagal menjadwalkan: " + err.message, "error");
    } finally {
        window.toggleLoading(false);
    }
};

window.waCampaigns = [];
window.renderCampaignsTable = async () => {
    const listContainer = document.getElementById('wa-campaigns-list');
    if (!listContainer) return;

    try {
        const snap = await db.collection("wa_campaigns").orderBy("created_at", "desc").limit(50).get();
        window.waCampaigns = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (window.waCampaigns.length === 0) {
            listContainer.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500 font-bold uppercase tracking-wider text-[10px]"><i class="fas fa-calendar-alt text-lg mb-2 block"></i>Belum ada kampanye terjadwal</td></tr>';
            return;
        }

        let html = "";
        window.waCampaigns.forEach(camp => {
            const schedTime = camp.scheduled_at ? new Date(camp.scheduled_at).toLocaleString("id-ID") : "-";
            const fileIndicator = camp.file_url ? `<a href="${camp.file_url}" target="_blank" class="text-indigo-400 hover:text-indigo-300 transition-colors"><i class="fas fa-paperclip text-[10px] mr-1"></i> File</a>` : `<span class="text-slate-600">-</span>`;
            
            let statusBadge = "bg-slate-500/20 text-slate-400 border border-slate-500/20";
            if (camp.status === "pending") statusBadge = "bg-blue-500/20 text-blue-400 border border-blue-500/20";
            else if (camp.status === "sending") statusBadge = "bg-purple-500/20 text-purple-400 border border-purple-500/20 animate-pulse";
            else if (camp.status === "completed") statusBadge = "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20";
            else if (camp.status === "cancelled") statusBadge = "bg-amber-500/20 text-amber-400 border border-amber-500/20";
            else if (camp.status === "failed") statusBadge = "bg-red-500/20 text-red-400 border border-red-500/20";

            const isPending = camp.status === "pending";
            const deleteBtn = isPending 
                ? `<button onclick="window.cancelScheduledCampaign('${camp.id}', '${camp.name}')" class="text-red-400 hover:text-red-300 w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center hover:bg-red-500/20 border border-red-500/10 hover:border-red-500/30 transition-all duration-200" title="Batalkan Jadwal"><i class="fas fa-trash-alt text-[11px]"></i></button>`
                : `<button disabled class="opacity-30 cursor-not-allowed text-slate-500 w-8 h-8 rounded-full border border-white/5 flex items-center justify-center"><i class="fas fa-ban text-[11px]"></i></button>`;

            html += `
                <tr class="hover:bg-white/5 transition-all">
                    <td class="p-3 font-bold text-white max-w-[150px] truncate" title="${camp.name}">${camp.name}</td>
                    <td class="p-3 text-[10px] text-slate-400 font-medium whitespace-nowrap">${schedTime}</td>
                    <td class="p-3 text-center max-w-[200px] truncate" title="${camp.message}">
                        <span class="text-[10px] text-slate-300 italic">"${camp.message}"</span>
                    </td>
                    <td class="p-3 text-center">
                        <div class="font-bold text-slate-200 text-[11px]">${camp.stats.success} / ${camp.stats.failed} / ${camp.stats.total}</div>
                        <div class="text-[8px] text-slate-500 tracking-wider font-black uppercase mt-0.5">${fileIndicator}</div>
                    </td>
                    <td class="p-3 text-center">
                        <span class="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${statusBadge}">
                            ${camp.status}
                        </span>
                    </td>
                    <td class="p-3 flex justify-center">
                        ${deleteBtn}
                    </td>
                </tr>
            `;
        });
        listContainer.innerHTML = html;
    } catch(err) {
        console.error("Gagal merender daftar kampanye:", err);
        listContainer.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-red-400 font-bold uppercase tracking-wider text-[10px]"><i class="fas fa-exclamation-triangle mr-1"></i> Gagal memuat kampanye: ${err.message}</td></tr>`;
    }
};

window.cancelScheduledCampaign = async (id, name) => {
    if (!confirm(`Apakah Anda yakin ingin membatalkan dan menghapus jadwal kampanye "${name}"?`)) return;
    
    window.toggleLoading(true, "Membatalkan Jadwal...");
    try {
        await db.collection("wa_campaigns").doc(id).delete();
        await window.logActivity("campaign_cancel", `Membatalkan & menghapus kampanye broadcast terjadwal "${name}"`);
        window.notify("Kampanye berhasil dibatalkan!", "success");
        window.renderCampaignsTable();
    } catch (e) {
        console.error("Gagal menghapus campaign:", e);
        window.notify("Gagal: " + e.message, "error");
    } finally {
        window.toggleLoading(false);
    }
};

window.initCampaignScheduler = () => {
    console.log("[SCHEDULER] Campaign Scheduler initialized successfully.");
    
    setTimeout(() => { window.renderCampaignsTable(); }, 2000);

    setInterval(async () => {
        if (!window.isWaConnected) return;

        try {
            const nowIso = new Date().toISOString();
            const snap = await db.collection("wa_campaigns")
                .where("status", "==", "pending")
                .get();
                
            const pendingCampaigns = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            for (const camp of pendingCampaigns) {
                if (camp.scheduled_at <= nowIso) {
                    window.runScheduledCampaign(camp);
                }
            }
        } catch (e) {
            console.error("[SCHEDULER] Background check error:", e);
        }
    }, 30000); 
};

window.runScheduledCampaign = async (camp) => {
    const campRef = db.collection("wa_campaigns").doc(camp.id);
    
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(campRef);
            if (!doc.exists) throw new Error("Campaign tidak ada");
            if (doc.data().status !== "pending") throw new Error("Campaign sudah dikerjakan perangkat lain");
            
            transaction.update(campRef, { status: "sending" });
        });
        
        console.log(`[SCHEDULER] Lease acquired for campaign "${camp.name}". Starting broadcast...`);
        window.dispatchCampaignMessages(camp);
    } catch (err) {
        console.log(`[SCHEDULER] Campaign "${camp.name}" already claimed by another active panitia device:`, err.message);
    }
};

window.dispatchCampaignMessages = async (camp) => {
    const campRef = db.collection("wa_campaigns").doc(camp.id);
    
    const targets = camp.targets || [];
    const fileUrl = camp.file_url;
    const delayVal = camp.delay_val || "3-5";
    
    const delayParts = delayVal.split('-');
    const minDelay = parseFloat(delayParts[0]) || 3;
    const maxDelay = parseFloat(delayParts[1]) || 5;

    let success = 0;
    let failed = 0;
    
    console.log(`[SCHEDULER] Campaign "${camp.name}" started. Targets count: ${targets.length}`);
    await window.logActivity("campaign_start", `Memulai eksekusi pengiriman kampanye terjadwal "${camp.name}"`);

    try {
        for (let i = 0; i < targets.length; i++) {
            const freshDoc = await campRef.get();
            if (freshDoc.exists && freshDoc.data().status === "cancelled") {
                console.log(`[SCHEDULER] Campaign "${camp.name}" cancelled midway by administrator.`);
                break;
            }

            const item = targets[i];
            
            if (i > 0) {
                const randomSec = Math.random() * (maxDelay - minDelay) + minDelay;
                await new Promise(r => setTimeout(r, randomSec * 1000));
            }

            const cleanPhone = item.type === 'personal' ? window.normalizePhoneNumber(item.target) : item.target;
            const msgText = item.type === 'personal'
                ? camp.message.replace(/\[Nama\]/g, item.name).replace(/\[Angkatan\]/g, item.angkatan || '')
                : camp.message.replace(/\[Nama\]/g, "Rekan-rekan").replace(/\[Angkatan\]/g, "");

            try {
                await window.sendWhatsAppInternal(cleanPhone, msgText, fileUrl, 'broadcast');
                success++;
            } catch (err) {
                failed++;
                console.error(`[SCHEDULER] Gagal mengirim campaign ke ${item.name}:`, err);
            }

            await campRef.update({
                "stats.success": success,
                "stats.failed": failed
            });
        }

        const finalDoc = await campRef.get();
        if (finalDoc.exists && finalDoc.data().status !== "cancelled") {
            await campRef.update({ status: "completed" });
            console.log(`[SCHEDULER] Campaign "${camp.name}" finished processing.`);
            await window.logActivity("campaign_complete", `Menyelesaikan kampanye terjadwal "${camp.name}" (Sukses: ${success}, Gagal: ${failed})`);
        }
        
        window.renderCampaignsTable();
    } catch (e) {
        console.error(`[SCHEDULER] Critical error in campaign run:`, e);
        await campRef.update({ status: "failed" });
        await window.logActivity("campaign_error", `Gagal memproses kampanye terjadwal "${camp.name}": ${e.message}`);
    }
};

window.sendPaymentReminder = async (nowa, nama, nominal, angkatan) => {
    const cleanPhone = window.normalizePhoneNumber(nowa);
    const nominalFormatted = window.formatRupiah(nominal);
    const msgText = `*PENGINGAT KONTRIBUSI REUNI AKBAR AL-FATAH*\n\n_Assalamu'alaikum Wr. Wb._\n\nKak *${nama}* (Alumni Angkatan *${angkatan || '-'}*),\n\nKami dari bendahara Panitia Reuni Akbar Al-Fatah ingin mengonfirmasi donasi/kontribusi Kakak sebesar *${nominalFormatted}* yang saat ini statusnya masih pending/belum lunas.\n\nHarap melengkapi pembayaran atau mengunggah bukti transfer resmi agar panitia dapat segera memverifikasinya.\n\nJika Kakak memerlukan informasi nomor rekening, silakan hubungi kami kembali.\n\nTerima kasih banyak atas dukungan dan kontribusi Kakak untuk menyukseskan reuni ini!\n\n_Wassalamu'alaikum Wr. Wb._`;

    window.toggleLoading(true, "Mengirim Pengingat...");
    try {
        await window.sendWhatsAppInternal(cleanPhone, msgText, null, 'finance');
        window.notify(`Pesan pengingat pembayaran berhasil dikirim ke ${nama}!`, "success");
    } catch (err) {
        console.error(err);
        window.notify("Gagal mengirim pengingat: " + err.message, "error");
    } finally {
        window.toggleLoading(false);
    }
};

window.setBroadcastTemplate = (type) => {
    const input = document.getElementById("broadcast-msg-input");
    if (!input) return;
    
    let text = "";
    if (type === 'rsvp') {
        text = `*KONFIRMASI KEHADIRAN (RSVP) REUNI AKBAR AL-FATAH*\n\n_Assalamu'alaikum Wr. Wb._\n\nHalo Kak *[Nama]* (Alumni Angkatan *[Angkatan]*),\n\nPanitia Reuni Akbar Al-Fatah ingin mendata kesediaan Kakak untuk menghadiri reuni silaturahmi kita.\n\nApakah Kakak akan hadir?\n*1. Ya, Saya Hadir*\n*2. Maaf, Berhalangan Hadir*\n\nHarap balas pesan ini dengan mengetik *1* atau *2* secara langsung.\n\nTerima kasih banyak atas partisipasinya!\n\n_Wassalamu'alaikum Wr. Wb._`;
    } else if (type === 'reminder') {
        text = `*PENGINGAT KONTRIBUSI REUNI AKBAR AL-FATAH*\n\n_Assalamu'alaikum Wr. Wb._\n\nHalo Kak *[Nama]* (Alumni Angkatan *[Angkatan]*),\n\nMengingatkan kembali untuk kontribusi partisipasi reuni akbar. Kakak dapat melengkapi pembayaran dan melakukan konfirmasi langsung melalui aplikasi.\n\nTerima kasih banyak atas kebaikan dan dukungan Kakak!\n\n_Wassalamu'alaikum Wr. Wb._`;
    } else if (type === 'undangan') {
        text = `*UNDANGAN RESMI SILATURAHMI REUNI AKBAR AL-FATAH*\n\n_Assalamu'alaikum Wr. Wb._\n\nMengharap kehadiran Kak *[Nama]* (Alumni Angkatan *[Angkatan]*) pada acara Reuni Akbar Alumni Pesantren Al-Fatah pada Ahad, 14 Juni 2026.\n\nUndangan resmi digital Kakak terlampir.\n\n_Wassalamu'alaikum Wr. Wb._`;
    }
    
    input.value = text;
    window.notify("Template berhasil diterapkan!", "success");
};
// window.sendWhatsAppInternal didefinisikan secara universal di awal file untuk menangani baik mode Aplikasi (Capacitor NodeJS) maupun Web API (Fonnte, WooWA, StarSender, Custom).

window.sendWhatsAppAPI = async (target, message, fileUrl = null, someParam = null, roleName = null, fileType = null) => {
    let role = 'broadcast';
    if (roleName && roleName.toLowerCase().includes('keuangan')) {
        role = 'finance';
    } else if (roleName && roleName.toLowerCase().includes('pendaftaran')) {
        role = 'broadcast';
    }
    return window.sendWhatsAppInternal(target, message, fileUrl, role, fileType);
};

window.generateAIMessage = (cleanName, nowa) => {
    window.notify('Fitur AI Message dinonaktifkan pada versi web murni.', 'warning');
};

// Auto-wake up ping to Hugging Face server when admin page loads
(async () => {
    try {
        setTimeout(async () => {
            const config = await window.getWaApiConfig();
            if (config && Object.keys(config).length > 0) {
                const serverUrl = (config.token_broadcast || '').trim();
                if (serverUrl && config.provider_broadcast === 'custom') {
                    console.log('[WA] Silent wakeup ping to server...');
                    fetch(`${serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl}/ping`).catch(() => {});
                }
            }
        }, 3000);
    } catch (e) {}
})();

window.loadWaApiSettingsIntoTab = async () => {
    try {
        const data = await window.getWaApiConfig();
        if (data && Object.keys(data).length > 0) {
            if (document.getElementById("set-wa-provider-verifikasi-tab"))
                document.getElementById("set-wa-provider-verifikasi-tab").value = data.provider_verifikasi || "fonnte";
            if (document.getElementById("set-wa-token-verifikasi-tab"))
                document.getElementById("set-wa-token-verifikasi-tab").value = data.token_verifikasi || "";

            if (document.getElementById("set-wa-provider-broadcast-tab"))
                document.getElementById("set-wa-provider-broadcast-tab").value = data.provider_broadcast || "fonnte";
            if (document.getElementById("set-wa-token-broadcast-tab"))
                document.getElementById("set-wa-token-broadcast-tab").value = data.token_broadcast || "";

            if (document.getElementById("set-wa-provider-keuangan-tab"))
                document.getElementById("set-wa-provider-keuangan-tab").value = data.provider_keuangan || "fonnte";
            if (document.getElementById("set-wa-token-keuangan-tab"))
                document.getElementById("set-wa-token-keuangan-tab").value = data.token_keuangan || "";
        }
    } catch (e) {
        console.error("Gagal memuat setting WA di Tab", e);
    }
};

window.handleWASettingsSubmitTab = async (e) => {
    if (e) e.preventDefault();
    
    // Batasi akses hanya untuk role 'creator' atau 'admin_utama'
    const userRole = (window.STATE.user && window.STATE.user.role || '').toLowerCase().trim();
    if (userRole !== 'creator' && userRole !== 'admin_utama') {
        window.notify("Akses ditolak! Hanya Kreator yang dapat menyunting pengaturan API WhatsApp.", "error");
        return;
    }
    
    window.toggleLoading(true, "Menyimpan pengaturan WA...");
    try {
        const verifikasi_provider = document.getElementById("set-wa-provider-verifikasi-tab").value;
        const verifikasi_token = document.getElementById("set-wa-token-verifikasi-tab").value;
        const broadcast_provider = document.getElementById("set-wa-provider-broadcast-tab").value;
        const broadcast_token = document.getElementById("set-wa-token-broadcast-tab").value;
        const keuangan_provider = document.getElementById("set-wa-provider-keuangan-tab").value;
        const keuangan_token = document.getElementById("set-wa-token-keuangan-tab").value;
        
        const configData = {
            ...window.lastWaApiConfig,
            provider_verifikasi: verifikasi_provider,
            token_verifikasi: verifikasi_token,
            provider_broadcast: broadcast_provider,
            token_broadcast: broadcast_token,
            provider_keuangan: keuangan_provider,
            token_keuangan: keuangan_token
        };
        
        await db.collection("settings").doc("whatsapp_api").set(configData, { merge: true });
        window.lastWaApiConfig = configData;
        
        // Trigger status check immediately
        if (typeof window.checkLocalWaStatus === 'function') {
            window.checkLocalWaStatus();
        }
        
        window.notify("Pengaturan API WA Berhasil Disimpan!", "success");
    } catch(err) {
        window.notify("Gagal menyimpan: " + err.message, "error");
    }
    window.toggleLoading(false);
};

window.openWASettingsWeb = async () => {
    try {
        const data = await window.getWaApiConfig();
        if (data && Object.keys(data).length > 0) {
            window.lastWaApiConfig = data;
            
            // Trigger status check immediately
            if (typeof window.checkLocalWaStatus === 'function') {
                window.checkLocalWaStatus();
            }

            if (document.getElementById("set-wa-local-url"))
                document.getElementById("set-wa-local-url").value = data.local_api_url || "";
            if (document.getElementById("set-wa-provider-verifikasi"))
                document.getElementById("set-wa-provider-verifikasi").value = data.provider_verifikasi || "fonnte";
            if (document.getElementById("set-wa-token-verifikasi"))
                document.getElementById("set-wa-token-verifikasi").value = data.token_verifikasi || "";
            if (document.getElementById("set-wa-provider-broadcast"))
                document.getElementById("set-wa-provider-broadcast").value = data.provider_broadcast || "fonnte";
            if (document.getElementById("set-wa-token-broadcast"))
                document.getElementById("set-wa-token-broadcast").value = data.token_broadcast || "";
            if (document.getElementById("set-wa-provider-keuangan"))
                document.getElementById("set-wa-provider-keuangan").value = data.provider_keuangan || "fonnte";
            if (document.getElementById("set-wa-token-keuangan"))
                document.getElementById("set-wa-token-keuangan").value = data.token_keuangan || "";
            
            let savedGroups = "[]";
            if (data.groups) {
                savedGroups = data.groups;
            }
            if (document.getElementById("set-wa-groups-data"))
                document.getElementById("set-wa-groups-data").value = savedGroups;

            // Fetch and populate wa_bot_config
            let botConfig = {};
            try {
                const configSnap = await db.collection("settings").doc("wa_bot_config").get();
                if (configSnap.exists) {
                    botConfig = configSnap.data();
                }
            } catch (botErr) {
                console.error("Failed to load wa_bot_config from Firestore:", botErr);
            }
            window.lastWaBotConfig = botConfig;

            if (document.getElementById("set-wa-schedule-enabled"))
                document.getElementById("set-wa-schedule-enabled").value = String(botConfig.schedule_enabled === true);
            if (document.getElementById("set-wa-schedule-frequency"))
                document.getElementById("set-wa-schedule-frequency").value = botConfig.schedule_frequency || "off";
            if (document.getElementById("set-wa-schedule-time"))
                document.getElementById("set-wa-schedule-time").value = botConfig.schedule_time || "08:00";
            if (document.getElementById("set-wa-report-template"))
                document.getElementById("set-wa-report-template").value = botConfig.report_template || "";
            if (document.getElementById("set-wa-iuran-info"))
                document.getElementById("set-wa-iuran-info").value = botConfig.iuran_info || "";
            if (document.getElementById("set-wa-approval-group-jid"))
                document.getElementById("set-wa-approval-group-jid").value = botConfig.approval_group_jid || "";
            if (document.getElementById("set-wa-group-pendataan-jid"))
                document.getElementById("set-wa-group-pendataan-jid").value = botConfig.group_pendataan_jid || "";
            if (document.getElementById("set-wa-group-log-jid"))
                document.getElementById("set-wa-group-log-jid").value = botConfig.group_log_jid || "";
            if (document.getElementById("set-wa-approval-admins"))
                document.getElementById("set-wa-approval-admins").value = botConfig.approval_admins || "";
            
            // Populate select-wa-group-auto dropdown from wa_registered_groups
            const autoSelect = document.getElementById("select-wa-group-auto");
            const registeredGroups = JSON.parse(localStorage.getItem('wa_registered_groups')) || [];
            if (autoSelect) {
                autoSelect.innerHTML = '<option value="">-- Pilih Grup / Channel --</option>' +
                    registeredGroups.map(g => {
                        const isChannel = (g.jid || '').endsWith('@newsletter');
                        const prefix = isChannel ? '[Channel] ' : '[Grup] ';
                        return `<option value="${g.jid}" data-name="${g.nama_grup || g.name || ''}">${prefix}${g.nama_grup || g.name || ''}</option>`;
                    }).join('');
            }

            // Populate all group dropdown selectors from wa_registered_groups
            const groupsOnly = registeredGroups.filter(g => (g.jid || '').endsWith('@g.us'));

            window.populateSelectWithSaved(
                document.getElementById("select-wa-approval-group-auto"),
                botConfig.approval_group_jid || "",
                groupsOnly,
                '-- Pilih Grup --'
            );

            window.populateSelectWithSaved(
                document.getElementById("select-wa-group-pendataan-auto"),
                botConfig.group_pendataan_jid || "",
                groupsOnly,
                '-- Pilih Grup --'
            );

            window.populateSelectWithSaved(
                document.getElementById("select-wa-group-log-auto"),
                botConfig.group_log_jid || "",
                groupsOnly,
                '-- Pilih Grup --'
            );
        }
        if (typeof window.renderWASettingsGroups === "function") {
            window.renderWASettingsGroups();
        }

        // Kunci input jika bukan role 'creator' atau 'admin_utama'
        const userRole = (window.STATE.user && window.STATE.user.role || '').toLowerCase().trim();
        const isCreator = userRole === 'creator' || userRole === 'admin_utama';
        const form = document.getElementById("form-wa-settings");
        if (form) {
            const inputs = form.querySelectorAll("input, select, button");
            inputs.forEach(inp => {
                if (inp.id !== "btn-close-wa-settings") {
                    inp.disabled = !isCreator;
                    if (!isCreator && inp.type !== 'submit') {
                        inp.style.opacity = "0.5";
                        inp.style.cursor = "not-allowed";
                    } else {
                        inp.style.opacity = "";
                        inp.style.cursor = "";
                    }
                }
            });
            
            let warningEl = document.getElementById("wa-api-creator-only-warning");
            if (!isCreator) {
                if (!warningEl) {
                    warningEl = document.createElement("div");
                    warningEl.id = "wa-api-creator-only-warning";
                    warningEl.className = "p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-center text-xs font-black uppercase tracking-wider mb-5 flex items-center justify-center gap-2";
                    warningEl.innerHTML = '<i class="fas fa-lock text-sm"></i> Hanya Kreator yang dapat menyunting pengaturan API WhatsApp';
                    form.parentNode.insertBefore(warningEl, form);
                }
            } else {
                if (warningEl) warningEl.remove();
            }
        }
    } catch (e) {
        console.error("Gagal memuat setting WA Web", e);
    }
};

window.handleAutoSelectWaGroup = (selectEl) => {
    if (!selectEl) return;
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    const jid = selectEl.value;
    if (!jid) return;
    const name = selectedOption.getAttribute("data-name") || "";
    const isChannel = jid.endsWith('@newsletter');

    const nameInput = document.getElementById("add-wa-group-name");
    const jidInput = document.getElementById("add-wa-group-jid");
    const typeSelect = document.getElementById("add-wa-group-type");

    if (nameInput) nameInput.value = name;
    if (jidInput) jidInput.value = jid;
    if (typeSelect) typeSelect.value = isChannel ? "channel" : "group";
};

window.fetchWaGroupsAndChannelsDirect = async () => {
    const config = await window.getWaApiConfig();
    if (!config || Object.keys(config).length === 0) {
        throw new Error('Pengaturan API WA belum diset.');
    }
    const localUrl = (config.local_api_url || '').trim();
    let list = [];

    if (localUrl) {
        let cleanLocalUrl = localUrl;
        let localApiKey = '';
        if (cleanLocalUrl.includes('|')) {
            const parts = cleanLocalUrl.split('|');
            cleanLocalUrl = parts[0].trim();
            localApiKey = parts[1].trim();
        }
        if (cleanLocalUrl.endsWith('/')) {
            cleanLocalUrl = cleanLocalUrl.slice(0, -1);
        }
        const headers = { 'ngrok-skip-browser-warning': 'true' };
        if (localApiKey) {
            headers['Authorization'] = `Bearer ${localApiKey}`;
        }
        
        // Fetch groups
        try {
            const res = await fetch(`${cleanLocalUrl}/api/groups`, { headers });
            const data = await res.json();
            if (data.success && data.groups) {
                data.groups.forEach(g => {
                    list.push({ jid: g.jid, name: g.name || 'Grup Tanpa Nama' });
                });
            }
        } catch (e) {
            console.warn('[WA] Gagal mengambil grup dari local API:', e.message);
        }

        // Fetch channels
        try {
            const res = await fetch(`${cleanLocalUrl}/api/channels`, { headers });
            const data = await res.json();
            if (data.success && data.channels) {
                data.channels.forEach(c => {
                    list.push({ jid: c.jid, name: c.name || 'Channel Tanpa Nama' });
                });
            }
        } catch (e) {
            console.warn('[WA] Gagal mengambil channel dari local API:', e.message);
        }
    } else {
        const provider = config.provider_broadcast || 'fonnte';
        const token = config.token_broadcast || '';

        if (provider === 'fonnte') {
            try {
                await fetch('https://api.fonnte.com/fetch-group', {
                    method: 'POST',
                    headers: { 'Authorization': token.trim() }
                });
            } catch (e) {}
            const res = await fetch('https://api.fonnte.com/get-whatsapp-group', {
                method: 'POST',
                headers: { 'Authorization': token.trim() }
            });
            const data = await res.json();
            if (data.status === true || data.status === 'true') {
                (data.data || []).forEach(g => {
                    list.push({ jid: g.id, name: g.name || 'Grup Tanpa Nama' });
                });
            }
        }
    }
    return list;
};

window.fetchGroupsForSelect = async (selectId, inputId, typeFilter = 'all') => {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;
    
    selectEl.innerHTML = '<option value="">Mengambil data dari WA...</option>';
    selectEl.disabled = true;
    
    try {
        const list = await window.fetchWaGroupsAndChannelsDirect();
        
        let filtered = list;
        if (typeFilter === 'group') {
            filtered = list.filter(item => (item.jid || '').endsWith('@g.us'));
        } else if (typeFilter === 'channel') {
            filtered = list.filter(item => (item.jid || '').endsWith('@newsletter'));
        }
        
        const inputEl = inputId ? document.getElementById(inputId) : null;
        const currentInputValue = inputEl ? inputEl.value.trim() : '';
        
        if (filtered.length === 0) {
            let optionsHtml = '<option value="">-- Tidak Ada Grup/Channel Ditemukan --</option>';
            if (currentInputValue) {
                optionsHtml += `<option value="${currentInputValue}" selected>Terarsip/Belum Sinkron: ${currentInputValue}</option>`;
            }
            selectEl.innerHTML = optionsHtml;
            window.notify('Tidak ada grup/channel yang ditemukan dari WhatsApp Anda.', 'warning');
        } else {
            let hasJid = false;
            let optionsHtml = '<option value="">-- Pilih --</option>';
            
            filtered.forEach(g => {
                const isChannel = (g.jid || '').endsWith('@newsletter');
                const prefix = isChannel ? '[Channel] ' : '[Grup] ';
                const isSelected = g.jid === currentInputValue;
                if (isSelected) hasJid = true;
                optionsHtml += `<option value="${g.jid}" data-name="${g.name || ''}" ${isSelected ? 'selected' : ''}>${prefix}${g.name || g.jid}</option>`;
            });
            
            if (currentInputValue && !hasJid) {
                optionsHtml += `<option value="${currentInputValue}" selected>Terarsip/Belum Sinkron: ${currentInputValue}</option>`;
            }
            
            selectEl.innerHTML = optionsHtml;
            
            if (currentInputValue) {
                selectEl.value = currentInputValue;
            }
            
            window.notify(`Berhasil mengambil ${filtered.length} grup/channel dari WhatsApp!`, 'success');
        }
    } catch (err) {
        selectEl.innerHTML = '<option value="">-- Gagal Mengambil Data --</option>';
        window.notify('Gagal mengambil dari WA: ' + err.message, 'error');
        console.error(err);
    } finally {
        selectEl.disabled = false;
    }
};

window.checkLocalWaStatus = async () => {
    // If running in native app (Capacitor NodeJS)
    const isNative = !!(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorNodeJS);
    
    // Select elements
    const dot = document.getElementById("wa-local-dot");
    const text = document.getElementById("wa-local-text");
    const activeInfo = document.querySelector("#wa-active-provider-info span");
    const nodeStatus = document.getElementById("wa-node-status");
    const connectionStatus = document.getElementById("wa-connection-status");
    const statusChips = document.getElementById("wa-status-chips");
    const localStatusEl = document.getElementById("wa-local-api-status");

    // Home dashboard status card elements
    const hCard = document.getElementById("home-wa-status-card");
    const hText = document.getElementById("home-wa-status-text");
    const hDot = document.getElementById("home-wa-status-dot");
    const hLabel = document.getElementById("home-wa-status-label");

    const updateHomeWidget = (borderClass, textVal, dotClass, labelVal) => {
        if (hCard) {
            hCard.classList.remove("border-slate-500", "border-emerald-500", "border-amber-500", "border-red-500");
            hCard.classList.add(borderClass);
        }
        if (hText) hText.innerText = textVal;
        if (hDot) hDot.className = dotClass;
        if (hLabel) hLabel.innerText = labelVal;
    };

    // Dynamic visibility of status chips on Web vs Native
    if (statusChips) {
        statusChips.classList.remove("hidden");
    }
    if (nodeStatus) {
        if (isNative) nodeStatus.classList.remove("hidden");
        else nodeStatus.classList.add("hidden");
    }
    if (connectionStatus) {
        if (isNative) connectionStatus.classList.remove("hidden");
        else connectionStatus.classList.add("hidden");
    }
    if (localStatusEl) {
        if (isNative) localStatusEl.classList.add("hidden");
        else localStatusEl.classList.remove("hidden");
    }

    // Read config
    const config = await window.getWaApiConfig();

    const localUrl = (config && config.local_api_url || '').trim();
    const onlineProvider = (config && config.provider_broadcast || 'fonnte').toUpperCase();

    if (localStatusEl) {
        localStatusEl.classList.remove("border-white/10", "border-emerald-500/30", "border-amber-500/30", "border-red-500/30");
    }

    if (!localUrl) {
        if (dot) {
            dot.className = "w-2 h-2 rounded-full bg-slate-500";
        }
        if (text) {
            text.innerText = "API LOKAL: BELUM DIATUR";
        }
        if (activeInfo) {
            activeInfo.innerText = `WhatsApp Aktif: API Online (${onlineProvider})`;
        }
        if (localStatusEl) {
            localStatusEl.classList.add("border-white/10");
        }
        updateHomeWidget("border-slate-500", "Status: API Lokal Belum Diatur", "w-2.5 h-2.5 rounded-full bg-slate-500", "Belum Diatur");
        return;
    }

    // Try to ping the local server
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5 seconds timeout

        let cleanLocalUrl = localUrl;
        let localApiKey = '';
        if (cleanLocalUrl.includes('|')) {
            const parts = cleanLocalUrl.split('|');
            cleanLocalUrl = parts[0].trim();
            localApiKey = parts[1].trim();
        }
        if (cleanLocalUrl.endsWith('/')) {
            cleanLocalUrl = cleanLocalUrl.slice(0, -1);
        }

        const headers = { 'ngrok-skip-browser-warning': 'true' };
        if (localApiKey) {
            headers['Authorization'] = `Bearer ${localApiKey}`;
        }
        const res = await fetch(`${cleanLocalUrl}/api/status?sessionId=${window.currentWaSessionId}`, { 
            headers: headers,
            signal: controller.signal 
        });
        clearTimeout(timeoutId);

        const data = await res.json();
        if (data && data.status === 'open') {
            const phone = data.user ? `+${data.user}` : 'Aktif';
            if (dot) {
                dot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
            }
            if (text) {
                text.innerText = `API LOKAL: AKTIF (${phone})`;
            }
            if (activeInfo) {
                activeInfo.innerText = `WhatsApp Aktif: API Lokal (${phone})`;
            }
            if (localStatusEl) {
                localStatusEl.classList.add("border-emerald-500/30");
            }
            
            updateHomeWidget("border-emerald-500", `Status: Terhubung (${phone})`, "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse", "Online");
            
            // Web/Browser Mode Specific Connection UI update
            if (!isNative) {
                const qrCodeEl = document.getElementById('wa-qr-code');
                const loadingState = document.getElementById('wa-loading-state');
                const connectedState = document.getElementById('wa-connected-state');
                if (qrCodeEl) qrCodeEl.classList.add('hidden');
                if (loadingState) loadingState.classList.add('hidden');
                if (connectedState) connectedState.classList.remove('hidden');
            }
        } else if (data && (data.status === 'qr' || data.status === 'connecting')) {
            if (dot) {
                dot.className = "w-2 h-2 rounded-full bg-amber-500 animate-pulse";
            }
            if (text) {
                text.innerText = "API LOKAL: SCAN QR";
            }
            if (activeInfo) {
                activeInfo.innerText = `WhatsApp Aktif: Fallback API Online (${onlineProvider}) (Lokal Menunggu Scan)`;
            }
            if (localStatusEl) {
                localStatusEl.classList.add("border-amber-500/30");
            }
            
            const isQr = data.status === 'qr';
            updateHomeWidget("border-amber-500", isQr ? "Status: Menunggu Scan QR" : "Status: Menghubungkan...", "w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse", isQr ? "Scan QR" : "Connecting");
            
            // Web/Browser Mode Specific Connection UI update
            if (!isNative) {
                const qrCodeEl = document.getElementById('wa-qr-code');
                const loadingState = document.getElementById('wa-loading-state');
                const connectedState = document.getElementById('wa-connected-state');
                
                if (data.status === 'qr' && data.qr) {
                    if (loadingState) loadingState.classList.add('hidden');
                    if (connectedState) connectedState.classList.add('hidden');
                    if (qrCodeEl) {
                        qrCodeEl.classList.remove('hidden');
                        const lastRenderedQr = qrCodeEl.getAttribute('data-qr-text');
                        if (lastRenderedQr !== data.qr) {
                            qrCodeEl.setAttribute('data-qr-text', data.qr);
                            qrCodeEl.innerHTML = '';
                            if (typeof QRCode !== 'undefined') {
                                new QRCode(qrCodeEl, {
                                    text: data.qr,
                                    width: 176,
                                    height: 176,
                                    colorDark: "#111626",
                                    colorLight: "#ffffff",
                                    correctLevel: QRCode.CorrectLevel.M
                                });
                            } else {
                                qrCodeEl.innerHTML = '<p class="text-xs text-red-400">Library QRCode.js tidak tersedia</p>';
                            }
                        }
                    }
                } else {
                    // data.status is 'connecting' (no QR yet)
                    if (qrCodeEl) qrCodeEl.classList.add('hidden');
                    if (connectedState) connectedState.classList.add('hidden');
                    if (loadingState) {
                        loadingState.classList.remove('hidden');
                        loadingState.innerHTML = '<div class="flex flex-col items-center justify-center gap-3"><div class="w-9 h-9 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div><span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Menghubungkan...</span></div>';
                    }
                }
            }
        } else {
            if (dot) {
                dot.className = "w-2 h-2 rounded-full bg-red-500";
            }
            if (text) {
                text.innerText = "API LOKAL: OFFLINE";
            }
            if (activeInfo) {
                activeInfo.innerText = `WhatsApp Aktif: Fallback API Online (${onlineProvider}) (Lokal Offline)`;
            }
            if (localStatusEl) {
                localStatusEl.classList.add("border-red-500/30");
            }
            
            updateHomeWidget("border-red-500", "Status: Terputus (Offline)", "w-2.5 h-2.5 rounded-full bg-red-500", "Offline");
            
            // Web/Browser Mode Specific Connection UI update
            if (!isNative) {
                const qrCodeEl = document.getElementById('wa-qr-code');
                const loadingState = document.getElementById('wa-loading-state');
                const connectedState = document.getElementById('wa-connected-state');
                if (qrCodeEl) qrCodeEl.classList.add('hidden');
                if (connectedState) connectedState.classList.add('hidden');
                if (loadingState) {
                    loadingState.classList.remove('hidden');
                    loadingState.innerHTML = '<i class="fas fa-exclamation-triangle text-amber-400 text-2xl mb-3"></i><p class="text-[9px] text-slate-400 font-bold tracking-widest uppercase text-center px-4">Terputus<br>Memuat ulang...</p>';
                }
            }
        }
    } catch (err) {
        if (dot) {
            dot.className = "w-2 h-2 rounded-full bg-red-500";
        }
        if (text) {
            text.innerText = "API LOKAL: OFFLINE";
        }
        if (activeInfo) {
            activeInfo.innerText = `WhatsApp Aktif: Fallback API Online (${onlineProvider}) (Lokal Offline)`;
        }
        if (localStatusEl) {
            localStatusEl.classList.add("border-red-500/30");
        }
        
        updateHomeWidget("border-red-500", "Status: Terputus (Offline)", "w-2.5 h-2.5 rounded-full bg-red-500", "Offline");
        
        // Web/Browser Mode Specific Connection UI update
        if (!isNative) {
            const qrCodeEl = document.getElementById('wa-qr-code');
            const loadingState = document.getElementById('wa-loading-state');
            const connectedState = document.getElementById('wa-connected-state');
            if (qrCodeEl) qrCodeEl.classList.add('hidden');
            if (connectedState) connectedState.classList.add('hidden');
            if (loadingState) {
                loadingState.classList.remove('hidden');
                loadingState.innerHTML = '<i class="fas fa-exclamation-triangle text-amber-400 text-2xl mb-3"></i><p class="text-[9px] text-slate-400 font-bold tracking-widest uppercase text-center px-4">Terputus<br>Memuat ulang...</p>';
            }
        }
    }
};

// Start the periodic status check (every 10 seconds)
setInterval(() => {
    window.checkLocalWaStatus().catch(e => console.error(e));
}, 10000);

// Perform initial check
setTimeout(() => {
    window.checkLocalWaStatus().catch(e => console.error(e));
}, 1000);

// ==========================================
// FITUR POSTING STATUS WHATSAPP
// ==========================================

window.handleWaStatusFileChange = (input) => {
    const file = input.files[0];
    const fileNameSpan = document.getElementById('wa-status-file-name');
    const clearBtn = document.getElementById('wa-status-file-clear');
    const previewContainer = document.getElementById('wa-status-image-preview-container');
    const previewImg = document.getElementById('wa-status-image-preview');

    if (!file) {
        window.clearWaStatusFile();
        return;
    }

    if (fileNameSpan) fileNameSpan.innerText = file.name;
    if (clearBtn) clearBtn.classList.remove('hidden');

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        if (previewImg) previewImg.src = e.target.result;
        if (previewContainer) previewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
};

window.clearWaStatusFile = () => {
    const fileInput = document.getElementById('wa-status-file');
    const fileNameSpan = document.getElementById('wa-status-file-name');
    const clearBtn = document.getElementById('wa-status-file-clear');
    const previewContainer = document.getElementById('wa-status-image-preview-container');
    const previewImg = document.getElementById('wa-status-image-preview');

    if (fileInput) fileInput.value = '';
    if (fileNameSpan) fileNameSpan.innerText = 'Belum ada gambar terpilih';
    if (clearBtn) clearBtn.classList.add('hidden');
    if (previewImg) previewImg.src = '';
    if (previewContainer) previewContainer.classList.add('hidden');
};

window.postWaStatus = async () => {
    const messageInput = document.getElementById('wa-status-message');
    const fileInput = document.getElementById('wa-status-file');
    const btn = document.getElementById('btn-wa-post-status');

    if (!messageInput) return;
    const message = messageInput.value.trim();
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;

    if (!message && !file) {
        return window.notify('Ketik pesan status atau pilih gambar terlebih dahulu!', 'error');
    }

    // Check configuration & server url
    const config = await window.getWaApiConfig();
    const localUrl = (config && config.local_api_url || '').trim();
    if (!localUrl) {
        return window.notify('Status hanya bisa diposting jika menggunakan Server WhatsApp Lokal!', 'error');
    }

    let cleanLocalUrl = localUrl;
    let localApiKey = '';
    if (cleanLocalUrl.includes('|')) {
        const parts = cleanLocalUrl.split('|');
        cleanLocalUrl = parts[0].trim();
        localApiKey = parts[1].trim();
    }
    if (cleanLocalUrl.endsWith('/')) {
        cleanLocalUrl = cleanLocalUrl.slice(0, -1);
    }

    // Change button state
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Memposting...';

    try {
        let fileUrl = null;
        let fileType = null;

        // If there's an image file, convert to base64
        if (file) {
            fileType = file.name.split('.').pop().toLowerCase();
            const reader = new FileReader();
            const base64Promise = new Promise((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
            });
            reader.readAsDataURL(file);
            fileUrl = await base64Promise;
        }

        const headers = {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
        };
        if (localApiKey) {
            headers['Authorization'] = `Bearer ${localApiKey}`;
        }

        const response = await fetch(`${cleanLocalUrl}/send-status`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                message: message,
                fileUrl: fileUrl,
                fileType: fileType
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server lokal mengembalikan error HTTP ${response.status}.`);
        }

        const data = await response.json();
        if (data && data.success) {
            window.notify('Status WhatsApp berhasil diposting!', 'success');
            messageInput.value = '';
            window.clearWaStatusFile();
        } else {
            throw new Error(data.error || 'Server gagal memproses posting status.');
        }
    } catch (err) {
        window.notify('Gagal memposting status: ' + err.message, 'error');
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};
