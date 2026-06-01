const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const dns = require('dns');

// Force IPv4 resolution first to bypass IPv6 handshake timeouts on Hugging Face Spaces
dns.setDefaultResultOrder('ipv4first');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc } = require('firebase/firestore');

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Firebase Configuration (Same as Client Side)
const firebaseConfig = {
    apiKey: "AIzaSyCfZ9zV6DOuSZoFoFvkW8NCSaxNlmn8R8k",
    authDomain: "reuniakbar.firebaseapp.com",
    projectId: "reuniakbar",
    storageBucket: "reuniakbar.firebasestorage.app",
    messagingSenderId: "542951643652",
    appId: "1:542951643652:web:1b4b7dac6c676a5d6c3351"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const AUTH_DIR = path.join(__dirname, 'auth_info');
let sock = null;
let qrCode = null;
let connectionStatus = 'connecting'; // 'connecting', 'qr', 'open', 'close'
let connectionUser = null;
let lastSyncHash = '';

// Helper to download session from Firestore
async function downloadSession(db) {
    if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
    try {
        console.log('[FIRESTORE] Downloading session files...');
        const docRef = doc(db, 'settings', 'wa_session');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            for (const [filename, content] of Object.entries(data)) {
                // Sanitize filename to prevent directory traversal
                const safeFilename = path.basename(filename);
                const filePath = path.join(AUTH_DIR, safeFilename);
                fs.writeFileSync(filePath, Buffer.from(content, 'base64'));
            }
            console.log('[FIRESTORE] Session downloaded successfully.');
        } else {
            console.log('[FIRESTORE] No session found, starting fresh.');
        }
    } catch (e) {
        console.error('[FIRESTORE] Error downloading session:', e);
    }
}

// Helper to upload session to Firestore
async function uploadSession(db) {
    if (!fs.existsSync(AUTH_DIR)) return;
    try {
        console.log('[FIRESTORE] Uploading session files...');
        const files = fs.readdirSync(AUTH_DIR);
        const data = {};
        for (const file of files) {
            const filePath = path.join(AUTH_DIR, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
                const content = fs.readFileSync(filePath);
                data[file] = content.toString('base64');
            }
        }
        
        if (Object.keys(data).length > 0) {
            const docRef = doc(db, 'settings', 'wa_session');
            await setDoc(docRef, data);
            console.log('[FIRESTORE] Session uploaded successfully.');
        }
    } catch (e) {
        console.error('[FIRESTORE] Error uploading session:', e);
    }
}

// Generate directory file hash to monitor modifications
function getFolderHash() {
    if (!fs.existsSync(AUTH_DIR)) return '';
    try {
        const files = fs.readdirSync(AUTH_DIR);
        let hash = '';
        for (const file of files) {
            const filePath = path.join(AUTH_DIR, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
                hash += file + stat.mtimeMs + stat.size;
            }
        }
        return hash;
    } catch (e) {
        return '';
    }
}

// Start auto sync background task
function startAutoSync(db) {
    setInterval(async () => {
        const currentHash = getFolderHash();
        if (currentHash && currentHash !== lastSyncHash) {
            lastSyncHash = currentHash;
            await uploadSession(db);
        }
    }, 10000); // Sync every 10 seconds if files changed
}

let isAutoSyncStarted = false;

// Network Diagnostics to debug connection and DNS issues in Hugging Face Spaces
function runNetworkDiagnostics() {
    console.log('[DIAGNOSTIC] Running network diagnostics...');
    
    // Test direct IP resolutions and TCP connects
    const hosts = ['web.whatsapp.com', 'wabi-ws.whatsapp.com'];
    const net = require('net');
    
    hosts.forEach(host => {
        dns.resolve(host, (err, addresses) => {
            if (err) {
                console.error(`[DIAGNOSTIC] DNS resolution failed for ${host}:`, err.message);
            } else {
                console.log(`[DIAGNOSTIC] DNS resolved for ${host}:`, addresses);
                if (addresses && addresses.length > 0) {
                    const ip = addresses[0];
                    console.log(`[DIAGNOSTIC] Attempting TCP connection to ${host} (${ip}):443...`);
                    const client = net.connect({ host: ip, port: 443 }, () => {
                        console.log(`[DIAGNOSTIC] TCP connection successful to ${host} (${ip}):443!`);
                        client.end();
                    });
                    client.on('error', (connectErr) => {
                        console.error(`[DIAGNOSTIC] TCP connection failed to ${host} (${ip}):443:`, connectErr.message);
                    });
                    client.setTimeout(10000, () => {
                        console.error(`[DIAGNOSTIC] TCP connection timed out for ${host} (${ip}):443`);
                        client.destroy();
                    });
                }
            }
        });
    });
}

async function connectToWhatsApp() {
    console.log('[WA] Connecting to WhatsApp...');
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    // Fetch the latest version dynamically with a robust fallback
    let waVersion = [2, 3000, 1017588726]; // Fallback version array
    try {
        const { version: latestVersion, isLatest } = await fetchLatestBaileysVersion();
        console.log(`[WA] Fetched WhatsApp Web v${latestVersion.join('.')}, isLatest: ${isLatest}`);
        waVersion = latestVersion;
    } catch (err) {
        console.error('[WA] Failed to fetch latest WhatsApp version from server, using stable fallback version:', err.message);
    }

    sock = makeWASocket({
        auth: state,
        version: waVersion,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: Browsers.ubuntu('Chrome'),
        connectTimeoutMs: 60000, // Extend timeout to 60 seconds
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCode = qr;
            connectionStatus = 'qr';
            console.log('New QR Code generated.');
        }

        if (connection === 'close') {
            qrCode = null;
            const error = lastDisconnect.error;
            const statusCode = error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`Connection closed: ${error?.message || error}. StatusCode: ${statusCode}. Reconnecting: ${shouldReconnect}`);
            connectionStatus = 'close';
            
            if (shouldReconnect) {
                console.log('[WA] Reconnecting in 5 seconds...');
                setTimeout(connectToWhatsApp, 5000);
            } else {
                console.log('Logged out from WhatsApp. Resetting session...');
                if (fs.existsSync(AUTH_DIR)) {
                    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
                }
                try {
                    const docRef = doc(db, 'settings', 'wa_session');
                    await setDoc(docRef, {});
                    console.log('Firestore session cleared.');
                } catch (e) {
                    console.error('Failed to clear Firestore session:', e);
                }
                setTimeout(connectToWhatsApp, 5000);
            }
        } else if (connection === 'open') {
            qrCode = null;
            connectionStatus = 'open';
            connectionUser = sock.user.id.split(':')[0];
            console.log('Connected to WhatsApp: ' + connectionUser);
            // Sync session immediately on successful login
            await uploadSession(db);
        }
    });
}

async function startServer() {
    // Run diagnostics
    runNetworkDiagnostics();

    // 1. Download session ONCE at startup
    await downloadSession(db);
    
    // 2. Start WhatsApp Connection
    await connectToWhatsApp();
    
    // 3. Start Auto Sync to Firestore ONCE
    if (!isAutoSyncStarted) {
        startAutoSync(db);
        isAutoSyncStarted = true;
    }
}

// Start Baileys WhatsApp Connection
startServer();

// --- HTTP ROUTES ---

// Render simple control webpage
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
        <meta charset="UTF-8">
        <title>WhatsApp Gateway - Reuni Akbar Ponpes AL-FATAH</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800;900&display=swap');
            body { font-family: 'Plus Jakarta Sans', sans-serif; background: #060813; color: #e2e8f0; }
            .glass { background: rgba(14, 18, 37, 0.65); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.06); }
        </style>
    </head>
    <body class="min-h-screen flex items-center justify-center p-4">
        <div class="glass w-full max-w-md p-8 rounded-[2.5rem] text-center shadow-2xl border border-indigo-500/20">
            <h1 class="text-2xl font-black text-white uppercase tracking-wider mb-2">WhatsApp Gateway</h1>
            <p class="text-xs text-slate-400 mb-6">Status Server: <span class="text-emerald-400 font-bold uppercase" id="status">${connectionStatus}</span></p>
            
            <div id="qr-container" class="bg-white p-5 rounded-3xl w-fit mx-auto mb-6 hidden border-4 border-indigo-500/20">
                <div id="qrcode" class="mx-auto"></div>
                <p class="text-[10px] text-indigo-900 mt-3 font-black uppercase tracking-wider">PENTING: Scan menggunakan WhatsApp HP Anda</p>
            </div>
            
            <div id="connected-container" class="hidden py-6">
                <div class="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 border border-emerald-500/20">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 class="text-lg font-black text-white mb-1">WhatsApp Terhubung!</h2>
                <p class="text-xs text-slate-400">Siap mengirim pesan otomatis.</p>
                <p class="text-sm text-emerald-400 font-black font-mono mt-3 bg-emerald-950/40 py-1.5 px-4 rounded-full border border-emerald-500/20 w-fit mx-auto" id="phone-number"></p>
            </div>
            
            <div id="connecting-container" class="py-6">
                <div class="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p class="text-xs text-slate-400">Menghubungkan ke WhatsApp...</p>
            </div>
        </div>
        
        <script>
            let lastStatus = '';
            function checkStatus() {
                fetch('/api/status')
                    .then(res => res.json())
                    .then(data => {
                        document.getElementById('status').innerText = data.status;
                        
                        if (data.status === 'qr' && data.qr) {
                            document.getElementById('connecting-container').classList.add('hidden');
                            document.getElementById('connected-container').classList.add('hidden');
                            document.getElementById('qr-container').classList.remove('hidden');
                            
                            if (lastStatus !== 'qr' || document.getElementById('qrcode').innerHTML === '') {
                                document.getElementById('qrcode').innerHTML = '';
                                new QRCode(document.getElementById('qrcode'), {
                                    text: data.qr,
                                    width: 200,
                                    height: 200,
                                    colorDark: "#0c112b",
                                    colorLight: "#ffffff"
                                });
                            }
                        } else if (data.status === 'open') {
                            document.getElementById('connecting-container').classList.add('hidden');
                            document.getElementById('qr-container').classList.add('hidden');
                            document.getElementById('connected-container').classList.remove('hidden');
                            document.getElementById('phone-number').innerText = '+' + data.user;
                        } else {
                            document.getElementById('qr-container').classList.add('hidden');
                            document.getElementById('connected-container').classList.add('hidden');
                            document.getElementById('connecting-container').classList.remove('hidden');
                        }
                        
                        lastStatus = data.status;
                    })
                    .catch(err => console.error(err));
            }
            setInterval(checkStatus, 3000);
            checkStatus();
        </script>
    </body>
    </html>
    `);
});

// GET Endpoint for status check
app.get('/api/status', (req, res) => {
    res.json({
        status: connectionStatus,
        qr: qrCode,
        user: connectionUser
    });
});

// POST Endpoint to send message
app.post('/send-message', async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({ success: false, error: 'Phone number and message are required.' });
    }

    if (connectionStatus !== 'open' || !sock) {
        return res.status(503).json({ success: false, error: 'WhatsApp bot is not connected.' });
    }

    try {
        // Normalize phone number (remove +, convert 08 to 628)
        let cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.startsWith('08')) {
            cleanPhone = '628' + cleanPhone.substring(2);
        }
        
        const jid = `${cleanPhone}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: message });
        
        console.log(`[WA BOT] Message sent successfully to ${cleanPhone}`);
        return res.json({ success: true });
    } catch (error) {
        console.error('[WA BOT] Failed to send message:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Keep Alive / Wake Up Endpoint
app.get('/ping', (req, res) => {
    res.json({ success: true, status: connectionStatus });
});

// Listen on environment port or 7860 for Hugging Face
const PORT = process.env.PORT || 7860;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
