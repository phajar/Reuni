// File: js/ocr-worker.js
importScripts('https://cdn.jsdelivr.net/npm/tesseract.js/dist/tesseract.min.js');

self.onmessage = async function(e) {
    const { imageBlob } = e.data;
    
    try {
        // Kirim status progress ke UI utama
        self.postMessage({ status: 'progress', message: 'Inisialisasi AI OCR...' });
        
        const worker = await Tesseract.createWorker('eng', 1, {
            logger: m => {
                if (m.status === 'recognizing text' && m.progress) {
                    self.postMessage({ 
                        status: 'progress', 
                        message: `Membaca piksel: ${Math.round(m.progress * 100)}%` 
                    });
                }
            }
        });

        self.postMessage({ status: 'progress', message: 'Menganalisa teks...' });
        const { data: { text } } = await worker.recognize(imageBlob);
        await worker.terminate();

        // Cari nominal menggunakan Regex
        const mt = text.match(/(?:Rp\.?\s?|\bIDR\s?)([\d.,]+)/i) || text.match(/\b(\d{1,3}(?:[.,]\d{3})+)\b/);
        
        if (mt) {
            const nominalBersih = mt[1].trim().replace(/[.,]\d{2}$/, '').replace(/\D/g, '');
            if (nominalBersih && parseInt(nominalBersih) > 0) {
                self.postMessage({ status: 'success', nominal: parseInt(nominalBersih) });
                return;
            }
        }
        
        self.postMessage({ status: 'error', message: 'Nominal tidak terdeteksi.' });

    } catch (error) {
        self.postMessage({ status: 'error', message: error.message });
    }
};