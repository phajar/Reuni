// PDF and Document Generation Service Module
(function() {

  // Helper to draw official committee signatures (Ketua, Sekretaris, Bendahara) automatically
  // Standard Tata Naskah Dinas: Baris 1 Kiri = Sekretaris, Baris 1 Kanan = Bendahara. Baris 2 Tengah = Ketua Panitia (Mengetahui)
  const drawCommitteeSignatures = (doc, finalY, type = "data") => {
      const list = (window.STATE && window.STATE.panitia) ? window.STATE.panitia : [];
      let ketua = null;
      let sekretaris = null;
      let bendahara = null;

      list.forEach(p => {
          const jab = (p.jabatan || "").toLowerCase();
          if (jab.includes("ketua") && !ketua) {
              ketua = p;
          } else if (jab.includes("sekretaris") && !sekretaris) {
              sekretaris = p;
          } else if (jab.includes("bendahara") && !bendahara) {
              bendahara = p;
          }
      });

      // Fallbacks to fill other slots if not found
      const usedIds = new Set();
      if (ketua) usedIds.add(ketua.id);
      if (sekretaris) usedIds.add(sekretaris.id);
      if (bendahara) usedIds.add(bendahara.id);

      const unused = list.filter(p => !usedIds.has(p.id));

      if (!ketua && unused.length > 0) { ketua = unused.shift(); }
      if (!sekretaris && unused.length > 0) { sekretaris = unused.shift(); }
      if (!bendahara && unused.length > 0) { bendahara = unused.shift(); }

      const sigKetua = ketua || { nama: "", jabatan: "Ketua Panitia", tanda_tangan: null };
      const sigSekretaris = sekretaris || { nama: "", jabatan: "Sekretaris", tanda_tangan: null };
      const sigBendahara = bendahara || { nama: "", jabatan: "Bendahara", tanda_tangan: null };

      // We draw exactly TWO signatures side-by-side in a single row:
      // Left side: Sekretaris (for 'data') or Bendahara (for 'finance')
      // Right side: Ketua Panitia (knowing/approval)
      
      const isFinance = type === "finance";
      const leftSig = isFinance ? sigBendahara : sigSekretaris;
      const rightSig = sigKetua;

      // Left signature (Center x=55, line x=35 to 75)
      doc.setFont("times", "bold");
      doc.text(leftSig.jabatan || (isFinance ? "Bendahara," : "Sekretaris,"), 55, finalY, { align: "center" });
      if (leftSig.tanda_tangan) {
          try {
              doc.addImage(leftSig.tanda_tangan, 'PNG', 35, finalY + 1, 40, 18);
          } catch (err) {
              console.error(`Gagal menambahkan tanda tangan ${isFinance ? 'Bendahara' : 'Sekretaris'}:`, err);
          }
      }
      doc.line(35, finalY + 20, 75, finalY + 20);
      doc.setFont("times", "normal");
      doc.text(leftSig.nama ? `( ${leftSig.nama} )` : "( ____________________ )", 55, finalY + 25, { align: "center" });

      // Right signature (Center x=155, line x=135 to 175)
      doc.setFont("times", "bold");
      doc.text("Mengetahui,", 155, finalY - 5, { align: "center" });
      doc.text(rightSig.jabatan || "Ketua Panitia,", 155, finalY, { align: "center" });
      if (rightSig.tanda_tangan) {
          try {
              doc.addImage(rightSig.tanda_tangan, 'PNG', 135, finalY + 1, 40, 18);
          } catch (err) {
              console.error("Gagal menambahkan tanda tangan Ketua:", err);
          }
      }
      doc.line(135, finalY + 20, 175, finalY + 20);
      doc.setFont("times", "normal");
      doc.text(rightSig.nama ? `( ${rightSig.nama} )` : "( ____________________ )", 155, finalY + 25, { align: "center" });
  };

  // --- Extracted from app.js (window.savePDF) ---
  window.savePDF = async (doc, fileName) => {
      try {
          const CapCore = window.capacitorExports ? window.capacitorExports.Capacitor : window.Capacitor;
          if (CapCore && CapCore.isNativePlatform && CapCore.isNativePlatform()) {
              const registerPlugin = (CapCore && CapCore.registerPlugin) ? CapCore.registerPlugin : (window.capacitorExports ? window.capacitorExports.registerPlugin : null);
              if (!registerPlugin) { doc.save(fileName); return; }
              const Filesystem = registerPlugin("Filesystem");
              const Share = registerPlugin("Share");
              const Directory = { Documents: "DOCUMENTS" };
              const base64Data = doc.output('datauristring').split(',')[1];
              
              try {
                  await Filesystem.requestPermissions();
              } catch(permErr) {
                  console.log("Permission request skipped:", permErr);
              }

              try {
                  const result = await Filesystem.writeFile({
                      path: fileName,
                      data: base64Data,
                      directory: Directory.Documents
                  });
                  
                  await Share.share({
                      title: fileName,
                      url: result.uri,
                  });
              } catch (writeErr) {
                  console.warn("Write to DOCUMENTS failed, using CACHE + Share fallback:", writeErr);
                  
                  const writeResult = await Filesystem.writeFile({
                      path: fileName,
                      data: base64Data,
                      directory: "CACHE",
                      recursive: true
                  });
                  
                  await Share.share({
                      title: fileName,
                      url: writeResult.uri,
                      dialogTitle: `Simpan/Kirim Berkas ${fileName} ke...`
                  });
                  window.notify(`Berkas ${fileName} siap! Silakan pilih lokasi penyimpanan.`, "success");
              }
          } else {
              doc.save(fileName);
          }
      } catch (e) {
          console.error("Gagal simpan/share PDF", e);
          window.notify("Gagal menyimpan PDF di perangkat: " + (e.message || "Coba lagi"), "error");
          throw e; // Rethrow to handle in caller
      }
  };


  // --- Extracted from app.js (window.printIDCard) ---
  window.printIDCard = async (dataStr) => {
    window.toggleLoading(true, "Mencetak ID Card...");
    try {
        const p = JSON.parse(decodeURIComponent(dataStr));
        await window._loadJsPDF();
        const { jsPDF } = window.jspdf;
        
        let logoBase64 = null;
        try {
            const response = await fetch("img/logo.png");
            const blob = await response.blob();
            logoBase64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        } catch(e) { console.error("Gagal memuat logo", e); }

        // Helper to crop image into a perfect circle with transparent background using Canvas
        const cropToCircle = (base64) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const size = Math.min(img.width, img.height);
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext("2d");
                    
                    // Draw a perfect circular path
                    ctx.beginPath();
                    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.clip(); // Clip all subsequent drawing to the circle
                    
                    // Draw centered square image
                    const x = (size - img.width) / 2;
                    const y = (size - img.height) / 2;
                    ctx.drawImage(img, x, y, img.width, img.height);
                    
                    resolve(canvas.toDataURL("image/png"));
                };
                img.onerror = () => resolve(base64); // Fallback to original
                img.src = base64;
            });
        };

        if (logoBase64) {
            logoBase64 = await cropToCircle(logoBase64);
        }

        const doc = new jsPDF("p", "mm", [54, 86]);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, 54, 86, "F");
        doc.setFillColor(79, 70, 229);
        doc.rect(0, 0, 54, 30, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("PANITIA REUNI AKBAR", 27, 10, { align: "center" });
        doc.setFontSize(13);
        doc.text("AL-FATAH", 27, 16, { align: "center" });
        
        doc.setFillColor(255, 255, 255);
        doc.circle(27, 30, 12, "F");
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.5);
        doc.circle(27, 30, 12, "S");
        
        if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', 17, 20, 20, 20);
        } else {
            doc.setFillColor(203, 213, 225);
            doc.circle(27, 27, 4, "F");
            doc.setLineWidth(3);
            doc.setDrawColor(203, 213, 225);
            doc.line(22, 36, 32, 36);
        }

        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(String(p.nama || "").substring(0, 20), 27, 50, {
          align: "center",
        });
        doc.setDrawColor(99, 102, 241);
        doc.setLineWidth(0.5);
        doc.line(15, 55, 39, 55);
        doc.setTextColor(245, 158, 11);
        const roleStr = p.divisi ? `${p.jabatan} (${p.divisi})` : (p.jabatan || "Panitia");
        const cleanRole = String(roleStr).toUpperCase();
        const fontSize = cleanRole.length > 20 ? 7.5 : (cleanRole.length > 15 ? 9 : 10);
        doc.setFontSize(fontSize);
        doc.text(cleanRole, 27, 62, {
          align: "center",
        });
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 76, 54, 10, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.text("ID CARD PANITIA RESMI", 27, 82, { align: "center" });
        await window.savePDF(doc, `IDCard_${p.nama}.pdf`);
        window.notify("ID Card dicetak & siap dibagikan!");
    } catch(err) {
        console.error(err);
        window.notify("Gagal mencetak ID Card", "error");
    } finally {
        window.toggleLoading(false);
    }
  };


  // --- Extracted from app.js (window.printReceipt) ---
  window.printReceipt = async (dataStr) => {
    window.toggleLoading(true, "Mencetak Kwitansi...");
    try {
        const data = JSON.parse(decodeURIComponent(dataStr));
    await window._loadJsPDF();
        const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", [105, 148]);
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(1);
    doc.roundedRect(5, 5, 95, 138, 3, 3);
    doc.setFillColor(99, 102, 241);
    doc.roundedRect(5, 5, 95, 25, 3, 3, "F");
    doc.rect(5, 15, 95, 15, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("PANITIA REUNI AKBAR", 52.5, 13, { align: "center" });
    doc.setFontSize(13);
    doc.text("PONDOK PESANTREN AL-FATAH", 52.5, 20, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Bukti Penerimaan Dana Sah", 52.5, 26, { align: "center" });
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("BUKTI TRANSAKSI (KWITANSI)", 52.5, 38, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(
      `No. Ref  : TRX-${String(data.id || "")
        .substring(0, 8)
        .toUpperCase()}`,
      10,
      46,
    );
    doc.text(`Tanggal  : ${String(data.tanggal || "-").split(",")[0]}`, 10, 50);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(10, 53, 95, 53);
    doc.text("Telah diterima dari:", 10, 60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`${data.nama_pembayar || "Hamba Allah"}`, 10, 65);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Untuk Keperluan:", 10, 73);
    doc.setFont("helvetica", "bold");
    doc.text(`${data.kategori || "-"}`, 10, 78);
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(10, 85, 85, 15, 2, 2, "F");
    doc.setTextColor(16, 185, 129);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`${window.formatRupiah(data.nominal_original || data.nominal)}`, 52.5, 95, {
      align: "center",
    });
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Disahkan oleh,", 75, 110, { align: "center" });
    
    // Find Bendahara signature
    const list = window.STATE && window.STATE.panitia ? window.STATE.panitia : [];
    const bendahara = list.find(p => (p.jabatan || "").toLowerCase().includes("bendahara")) || list[0];
    
    if (bendahara && bendahara.tanda_tangan) {
      try {
        doc.addImage(bendahara.tanda_tangan, 'PNG', 55, 110, 40, 14);
      } catch (err) {
        console.error("Gagal menggambar tanda tangan Bendahara di kwitansi:", err);
      }
    }
    
    doc.setFont("helvetica", "bold");
    doc.text(bendahara ? `( ${bendahara.nama} )` : "Bendahara Panitia", 75, 125, { align: "center" });
    if (bendahara) {
      doc.setFontSize(6);
      doc.setFont("helvetica", "normal");
      doc.text("Bendahara Panitia", 75, 129, { align: "center" });
    } else {
      doc.setFont("helvetica", "normal");
    }
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Kwitansi otomatis sistem. Dicetak: ${new Date().toLocaleString("id-ID")}`,
      52.5,
      138,
      { align: "center" },
    );
    await window.savePDF(doc, `Kwitansi_${data.nama_pembayar}.pdf`);
    window.notify("Kwitansi PDF diunduh & siap dibagikan!");
    } catch (err) {
        console.error(err);
        window.notify("Gagal mencetak kwitansi", "error");
    } finally {
        window.toggleLoading(false);
    }
  };


  // --- Extracted from app.js (window.exportToPDF) ---
  window.exportToPDF = async (size) => {
    window.toggleLoading(true, "Membuat Laporan PDF...");
    try {
        await window._loadJsPDF();
        const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", size === "f4" ? [215, 330] : "a4");
    
    // 1. KOP SURAT RESMI (Official Header)
    try {
      const logoImg = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = "img/logo.png";
      });
      if (logoImg) {
        doc.addImage(logoImg, "PNG", 18, 11, 16, 16);
      }
    } catch (logoErr) {
      console.error("Failed to load logo in PDF:", logoErr);
    }

    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text("ALUMNI PONDOK PESANTREN", 112, 16, { align: "center" });
    doc.text("AL-FATAH TEGALWARU PURWAKARTA", 112, 21, { align: "center" });
    
    doc.setFont("times", "italic");
    doc.setFontSize(10);
    doc.text("Jl. BBI Cirata Kp. Cilangkap Rt. 10 Rw.05 Cadassari Tegalwaru Purwakarta 41165", 112, 26, { align: "center" });
    
    // Decorative double lines
    doc.setLineWidth(0.8);
    doc.setDrawColor(0, 0, 0);
    doc.line(15, 30, 195, 30);
    doc.setLineWidth(0.2);
    doc.line(15, 31, 195, 31);
    
    // Check if called from Rekap Wilayah tab
    const tabRekap = document.getElementById("tab-rekap");
    const isRekapTab = tabRekap && !tabRekap.classList.contains("hidden");
    
    // 2. JUDUL DOKUMEN & DETAIL WILAYAH
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    if (isRekapTab) {
      doc.text("LAPORAN DATA ALUMNI - REKAP WILAYAH", 105, 38, { align: "center" });
      
      const kab = document.getElementById("filter-kab")?.value || "";
      const kec = document.getElementById("filter-kec")?.value || "";
      const des = document.getElementById("filter-desa")?.value || "";
      let wilayahText = "Semua Wilayah";
      if (kab || kec || des) {
        const parts = [];
        if (kab) parts.push(`Kab. ${kab}`);
        if (kec) parts.push(`Kec. ${kec}`);
        if (des) parts.push(`Desa ${des}`);
        wilayahText = parts.join(", ");
      }
      
      doc.setFont("times", "bolditalic");
      doc.setFontSize(10);
      doc.text(`Wilayah: ${wilayahText}`, 105, 43, { align: "center" });
      
      doc.setFont("times", "normal");
      doc.text(`Tanggal Cetak Dokumen: ${new Date().toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 105, 48, { align: "center" });
    } else {
      doc.text("LAPORAN DATA ALUMNI TERDAFTAR", 105, 40, { align: "center" });
      doc.setFont("times", "normal");
      doc.setFontSize(10);
      doc.text(`Tanggal Cetak Dokumen: ${new Date().toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 105, 45, { align: "center" });
    }

    // 3. TABLE DATA ALUMNI (Menggunakan filteredRekapData jika berada di tab Rekap)
    const dataToExport = isRekapTab ? (window.filteredRekapData || []) : window.STATE.alumni;
    
    doc.autoTable({
      startY: isRekapTab ? 54 : 52,
      head: [["No", "Nama Alumni", "Angkatan", "Lembaga", "Kabupaten", "Kecamatan", "Alamat Tinggal"]],
      body: dataToExport.map((a, i) => [
        i + 1,
        a.nama,
        a.angkatan,
        a.lembaga || "-",
        a.kabupaten,
        a.kecamatan,
        a.alamat,
      ]),
      styles: { font: "times", fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [15, 23, 42], fontStyle: "bold" },
      columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 40 },
          2: { cellWidth: 18, halign: "center" },
          3: { cellWidth: 18, halign: "center" },
          4: { cellWidth: 30 },
          5: { cellWidth: 30 },
          6: { cellWidth: "auto" }
      }
    });

    // 4. SIGNATURES
    let finalY = doc.lastAutoTable.finalY + 15;
    if (finalY > 220) {
        doc.addPage();
        finalY = 30;
    }
    
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.text("Hormat kami,", 105, finalY, { align: "center" });
    doc.setFont("times", "bold");
    doc.text("PANITIA PELAKSANA REUNI AKBAR AL-FATAH", 105, finalY + 5, { align: "center" });
    
    finalY += 15;
    
    drawCommitteeSignatures(doc, finalY, "data");

    let pdfFileName = "Laporan_Alumni.pdf";
    if (isRekapTab) {
      const kab = document.getElementById("filter-kab")?.value || "";
      const kec = document.getElementById("filter-kec")?.value || "";
      const des = document.getElementById("filter-desa")?.value || "";
      const searchVal = document.getElementById("search-wilayah-input")?.value || "";
      
      let suffix = "";
      if (kab) suffix += `_${kab}`;
      if (kec) suffix += `_${kec}`;
      if (des) suffix += `_${des}`;
      if (searchVal) suffix += `_Cari_${searchVal}`;
      
      suffix = suffix.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");
      
      pdfFileName = suffix ? `Laporan_Alumni_Wilayah${suffix}.pdf` : "Laporan_Alumni_Wilayah.pdf";
    }
    await window.savePDF(doc, pdfFileName);
    window.closeModal("modal-export");
    } catch (err) {
        console.error(err);
        window.notify("Gagal membuat laporan PDF", "error");
    } finally {
        window.toggleLoading(false);
    }
  };


  // --- Extracted from app.js (window.exportDaftarHadirPDF) ---
  window.exportDaftarHadirPDF = async () => {
    await window._loadJsPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");
    
    // 1. KOP SURAT RESMI (Official Header)
    try {
      const logoImg = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = "img/logo.png";
      });
      if (logoImg) {
        doc.addImage(logoImg, "PNG", 18, 11, 16, 16);
      }
    } catch (logoErr) {
      console.error("Failed to load logo in PDF:", logoErr);
    }

    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text("ALUMNI PONDOK PESANTREN", 112, 16, { align: "center" });
    doc.text("AL-FATAH TEGALWARU PURWAKARTA", 112, 21, { align: "center" });
    
    doc.setFont("times", "italic");
    doc.setFontSize(10);
    doc.text("Jl. BBI Cirata Kp. Cilangkap Rt. 10 Rw.05 Cadassari Tegalwaru Purwakarta 41165", 112, 26, { align: "center" });
    
    // Decorative double lines
    doc.setLineWidth(0.8);
    doc.setDrawColor(0, 0, 0);
    doc.line(15, 30, 195, 30);
    doc.setLineWidth(0.2);
    doc.line(15, 31, 195, 31);
    
    // 2. JUDUL DOKUMEN
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("DAFTAR HADIR PESERTA REUNI AKBAR", 105, 40, { align: "center" });
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.text(`Tanggal Cetak Dokumen: ${new Date().toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 105, 45, { align: "center" });

    // 3. TABLE DAFTAR HADIR
    const rows = [];
    for (let i = 0; i < 50; i++)
      rows.push([
        i + 1,
        "",
        "",
        "",
        "",
        i % 2 === 0 ? `${i + 1}. .........` : `      ${i + 1}. .........`,
      ]);

    doc.autoTable({
      startY: 52,
      head: [["No", "Nama Lengkap Alumni", "Angkatan", "Lembaga", "No HP / Domisili", "Tanda Tangan"]],
      body: rows,
      styles: { font: "times", fontSize: 10, minCellHeight: 11, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 45 },
        5: { cellWidth: 40 },
      },
    });

    // 4. SIGNATURES
    let finalY = doc.lastAutoTable.finalY + 15;
    if (finalY > 220) {
        doc.addPage();
        finalY = 30;
    }
    
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.text("Hormat kami,", 105, finalY, { align: "center" });
    doc.setFont("times", "bold");
    doc.text("PANITIA PELAKSANA REUNI AKBAR AL-FATAH", 105, finalY + 5, { align: "center" });
    
    finalY += 15;
    
    drawCommitteeSignatures(doc, finalY, "data");

    window.savePDF(doc, `Daftar_Hadir.pdf`);
    window.closeModal("modal-export");
  };


  // --- Extracted from app.js (window.exportFinanceToPDF) ---
  window.exportFinanceToPDF = async () => {
    await window._loadJsPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");
    
    // 1. KOP SURAT RESMI (Official Header)
    try {
      const logoImg = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = "img/logo.png";
      });
      if (logoImg) {
        doc.addImage(logoImg, "PNG", 18, 11, 16, 16);
      }
    } catch (logoErr) {
      console.error("Failed to load logo in PDF:", logoErr);
    }

    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text("ALUMNI PONDOK PESANTREN", 112, 16, { align: "center" });
    doc.text("AL-FATAH TEGALWARU PURWAKARTA", 112, 21, { align: "center" });
    
    doc.setFont("times", "italic");
    doc.setFontSize(10);
    doc.text("Jl. BBI Cirata Kp. Cilangkap Rt. 10 Rw.05 Cadassari Tegalwaru Purwakarta 41165", 112, 26, { align: "center" });
    
    // Decorative double lines
    doc.setLineWidth(0.8);
    doc.setDrawColor(0, 0, 0);
    doc.line(15, 30, 195, 30);
    doc.setLineWidth(0.2);
    doc.line(15, 31, 195, 31);
    
    // 2. JUDUL DOKUMEN
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("LAPORAN KEUANGAN REUNI AKBAR", 105, 40, { align: "center" });
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.text(`Tanggal Cetak Dokumen: ${new Date().toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 105, 45, { align: "center" });

    let inC = 0,
      outC = 0;
    window.STATE.finance.forEach((f) => {
      let v = Number(f.nominal) || 0;
      if (f.status.toLowerCase() === "pengeluaran") outC += v;
      else inC += v;
    });

    // 3. REKAPITULASI DANA
    let startY = 52;
    doc.setFont("times", "normal");
    doc.setFillColor(245, 247, 250);
    doc.rect(15, startY, 180, 20, "F");
    doc.setDrawColor(200, 200, 200);
    doc.rect(15, startY, 180, 20, "S");
    
    doc.setFont("times", "bold");
    doc.text("Realisasi Pemasukan Kas :", 20, startY + 6);
    doc.setFont("times", "normal");
    doc.text(window.formatRupiah(inC), 90, startY + 6, { align: "right" });
    
    doc.setFont("times", "bold");
    doc.text("Realisasi Pengeluaran Kas:", 20, startY + 13);
    doc.setFont("times", "normal");
    doc.text(window.formatRupiah(outC), 90, startY + 13, { align: "right" });
    
    doc.setFont("times", "bold");
    doc.text("Saldo Kas Riil Saat Ini :", 110, startY + 10);
    doc.text(window.formatRupiah(inC - outC), 185, startY + 10, { align: "right" });

    // 4. RINCIAN TABEL KAS
    const tableBody = window.STATE.finance.map((f, i) => [
      i + 1,
      String(f.tanggal || "-").split(",")[0],
      f.nama || f.keterangan || f.nama_pembayar || "-",
      f.kategori || "-",
      f.status.toLowerCase() === "pengeluaran" ? "Keluar" : "Masuk",
      window.formatRupiah(f.nominal),
    ]);

    doc.autoTable({
      startY: startY + 25,
      head: [["No", "Tanggal", "Keterangan Transaksi", "Kategori", "Aliran", "Nominal"]],
      body: tableBody,
      styles: { font: "times", fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [15, 23, 42], fontStyle: "bold" }, // Formal Dark Navy
      columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 25 },
          2: { cellWidth: 70 },
          3: { cellWidth: 30 },
          4: { cellWidth: 20, halign: "center" },
          5: { cellWidth: 25, halign: "right" }
      },
      didParseCell: function (data) {
          if (data.section === "body" && data.column.index === 4) {
              data.cell.styles.textColor = data.cell.text[0] === "Keluar" ? [180, 0, 0] : [0, 100, 0];
              data.cell.styles.fontStyle = "bold";
          }
      }
    });

    // 5. TANDA TANGAN PANITIA
    let finalY = doc.lastAutoTable.finalY + 15;
    if (finalY > 220) {
        doc.addPage();
        finalY = 30;
    }
    
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.text("Hormat kami,", 105, finalY, { align: "center" });
    doc.setFont("times", "bold");
    doc.text("PANITIA PELAKSANA REUNI AKBAR AL-FATAH", 105, finalY + 5, { align: "center" });
    
    finalY += 15;
    
    drawCommitteeSignatures(doc, finalY, "finance");

    window.savePDF(doc, `Keuangan.pdf`);
  };


  // --- Extracted from app.js (window.exportRABToPDF) ---
  window.exportRABToPDF = async () => {
    await window._loadJsPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");
    
    // 1. KOP SURAT RESMI (Official Header)
    try {
      const logoImg = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = "img/logo.png";
      });
      if (logoImg) {
        doc.addImage(logoImg, "PNG", 18, 11, 16, 16);
      }
    } catch (logoErr) {
      console.error("Failed to load logo in PDF:", logoErr);
    }

    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text("ALUMNI PONDOK PESANTREN", 112, 16, { align: "center" });
    doc.text("AL-FATAH TEGALWARU PURWAKARTA", 112, 21, { align: "center" });
    
    doc.setFont("times", "italic");
    doc.setFontSize(10);
    doc.text("Jl. BBI Cirata Kp. Cilangkap Rt. 10 Rw.05 Cadassari Tegalwaru Purwakarta 41165", 112, 26, { align: "center" });
    
    // Decorative double lines
    doc.setLineWidth(0.8);
    doc.setDrawColor(0, 0, 0);
    doc.line(15, 30, 195, 30);
    doc.setLineWidth(0.2);
    doc.line(15, 31, 195, 31);
    
    // 2. JUDUL DOKUMEN
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("RENCANA ANGGARAN BIAYA (RAB) REUNI AKBAR", 105, 40, { align: "center" });
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.text(`Tanggal Cetak Dokumen: ${new Date().toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 105, 45, { align: "center" });

    // 3. TABLE DATA RAB
    let tRAB = 0;
    const rows = window.STATE.rab.map((r, i) => {
      const n = Number(r.nominal) || 0;
      tRAB += n;
      return [
        i + 1,
        r.nama_pembayar || "-",
        window.formatRupiah(n),
        r.status === "pengeluaran" ? "Sudah Realisasi" : "Belum Realisasi",
      ];
    });
    rows.push([
      {
        content: "TOTAL ANGGARAN",
        colSpan: 2,
        styles: { halign: "right", fontStyle: "bold", font: "times" },
      },
      {
        content: window.formatRupiah(tRAB),
        styles: { fontStyle: "bold", textColor: [15, 23, 42], font: "times" },
      },
      "",
    ]);

    doc.autoTable({
      startY: 52,
      head: [["No", "Nama Item Anggaran", "Estimasi Anggaran", "Status Realisasi"]],
      body: rows,
      styles: { font: "times", fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [15, 23, 42], fontStyle: "bold" },
      columnStyles: {
          0: { cellWidth: 15, halign: "center" },
          1: { cellWidth: 90 },
          2: { cellWidth: 40, halign: "right" },
          3: { cellWidth: 35, halign: "center" }
      }
    });

    // 4. SIGNATURES
    let finalY = doc.lastAutoTable.finalY + 15;
    if (finalY > 220) {
        doc.addPage();
        finalY = 30;
    }
    
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    doc.text("Hormat kami,", 105, finalY, { align: "center" });
    doc.setFont("times", "bold");
    doc.text("PANITIA PELAKSANA REUNI AKBAR AL-FATAH", 105, finalY + 5, { align: "center" });
    
    finalY += 15;
    
    drawCommitteeSignatures(doc, finalY, "finance");

    window.savePDF(doc, `RAB_Reuni.pdf`);
  };


  // --- Extracted from app.js (window.generateLaporanFile) ---
  window.generateLaporanFile = async (format) => {
    let fileBlob = null;
    let fileName = "";

    if (format === "pdf") {
      await window._loadJsPDF();
      const { jsPDF } = window.jspdf;
      const docPdf = new jsPDF("p", "mm", "a4");
      
      // 1. KOP SURAT RESMI (Official Header)
      try {
        const logoImg = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = "img/logo.png";
        });
        if (logoImg) {
          docPdf.addImage(logoImg, "PNG", 18, 11, 16, 16);
        }
      } catch (logoErr) {
        console.error("Failed to load logo in PDF:", logoErr);
      }

      docPdf.setFont("times", "bold");
      docPdf.setFontSize(14);
      docPdf.text("ALUMNI PONDOK PESANTREN", 112, 16, { align: "center" });
      docPdf.text("AL-FATAH TEGALWARU PURWAKARTA", 112, 21, { align: "center" });
      
      docPdf.setFont("times", "italic");
      docPdf.setFontSize(10);
      docPdf.text("Jl. BBI Cirata Kp. Cilangkap Rt. 10 Rw.05 Cadassari Tegalwaru Purwakarta 41165", 112, 26, { align: "center" });
      
      // Decorative double lines
      docPdf.setLineWidth(0.8);
      docPdf.setDrawColor(0, 0, 0);
      docPdf.line(15, 30, 195, 30);
      docPdf.setLineWidth(0.2);
      docPdf.line(15, 31, 195, 31);
      
      // 2. JUDUL DOKUMEN
      docPdf.setFont("times", "bold");
      docPdf.setFontSize(12);
      docPdf.text("LAPORAN KEUANGAN REUNI AKBAR", 105, 40, { align: "center" });
      docPdf.setFont("times", "normal");
      docPdf.setFontSize(10);
      docPdf.text(`Tanggal Cetak Dokumen: ${new Date().toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 105, 45, { align: "center" });

      let inC = 0,
        outC = 0;
      window.STATE.finance.forEach((f) => {
        let v = Number(f.nominal) || 0;
        if (f.status.toLowerCase() === "pengeluaran") outC += v;
        else inC += v;
      });

      // 3. REKAPITULASI DANA
      let startY = 52;
      docPdf.setFont("times", "normal");
      docPdf.setFillColor(245, 247, 250);
      docPdf.rect(15, startY, 180, 20, "F");
      docPdf.setDrawColor(200, 200, 200);
      docPdf.rect(15, startY, 180, 20, "S");
      
      docPdf.setFont("times", "bold");
      docPdf.text("Realisasi Pemasukan Kas :", 20, startY + 6);
      docPdf.setFont("times", "normal");
      docPdf.text(window.formatRupiah(inC), 90, startY + 6, { align: "right" });
      
      docPdf.setFont("times", "bold");
      docPdf.text("Realisasi Pengeluaran Kas:", 20, startY + 13);
      docPdf.setFont("times", "normal");
      docPdf.text(window.formatRupiah(outC), 90, startY + 13, { align: "right" });
      
      docPdf.setFont("times", "bold");
      docPdf.text("Saldo Kas Riil Saat Ini :", 110, startY + 10);
      docPdf.text(window.formatRupiah(inC - outC), 185, startY + 10, { align: "right" });

      // 4. RINCIAN TABEL KAS
      const tableBody = window.STATE.finance.map((f, i) => [
        i + 1,
        String(f.tanggal || "-").split(",")[0],
        f.nama || f.keterangan || f.nama_pembayar || "-",
        f.kategori || "-",
        f.status.toLowerCase() === "pengeluaran" ? "Keluar" : "Masuk",
        window.formatRupiah(f.nominal),
      ]);

      docPdf.autoTable({
        startY: startY + 25,
        head: [["No", "Tanggal", "Keterangan Transaksi", "Kategori", "Aliran", "Nominal"]],
        body: tableBody,
        styles: { font: "times", fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42], fontStyle: "bold" }, // Formal Dark Navy
        columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            1: { cellWidth: 25 },
            2: { cellWidth: 70 },
            3: { cellWidth: 30 },
            4: { cellWidth: 20, halign: "center" },
            5: { cellWidth: 25, halign: "right" }
        },
        didParseCell: function (data) {
            if (data.section === "body" && data.column.index === 4) {
                data.cell.styles.textColor = data.cell.text[0] === "Keluar" ? [180, 0, 0] : [0, 100, 0];
                data.cell.styles.fontStyle = "bold";
            }
        }
      });

      // 5. TANDA TANGAN PANITIA
      let finalY = docPdf.lastAutoTable.finalY + 15;
      if (finalY > 220) {
          docPdf.addPage();
          finalY = 30;
      }
      
      docPdf.setFont("times", "normal");
      docPdf.setFontSize(10);
      docPdf.text("Hormat kami,", 105, finalY, { align: "center" });
      docPdf.setFont("times", "bold");
      docPdf.text("PANITIA PELAKSANA REUNI AKBAR AL-FATAH", 105, finalY + 5, { align: "center" });
      
      finalY += 15;
      
      drawCommitteeSignatures(docPdf, finalY, "finance");

      fileBlob = docPdf.output("blob");
      fileName = "Laporan_Keuangan_Reuni.pdf";
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 930;
      const ctx = canvas.getContext("2d");

      const loadImg = (src) => {
        if (!src) return Promise.resolve(null);
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        });
      };

      // 1. Background & Border
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

      // 2. Official Header Logo & Text
      const logoImg = await loadImg("img/logo.png");
      if (logoImg) {
        ctx.drawImage(logoImg, 50, 40, 60, 60);
      }

      ctx.fillStyle = "#000000";
      ctx.textAlign = "center";
      
      ctx.font = "bold 20px 'Times New Roman', Times, serif";
      ctx.fillText("ALUMNI PONDOK PESANTREN", 430, 58);
      
      ctx.font = "bold 20px 'Times New Roman', Times, serif";
      ctx.fillText("AL-FATAH TEGALWARU PURWAKARTA", 430, 83);
      
      ctx.font = "italic 11px 'Times New Roman', Times, serif";
      ctx.fillStyle = "#333333";
      ctx.fillText("Jl. BBI Cirata Kp. Cilangkap Rt. 10 Rw.05 Cadassari Tegalwaru Purwakarta 41165", 430, 105);

      // Decorative Double Lines
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(50, 117);
      ctx.lineTo(750, 117);
      ctx.stroke();
      
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(50, 122);
      ctx.lineTo(750, 122);
      ctx.stroke();

      // 3. Document Title Section
      ctx.fillStyle = "#000000";
      ctx.textAlign = "center";
      
      ctx.font = "bold 16px 'Times New Roman', Times, serif";
      ctx.fillText("LAPORAN KEUANGAN REUNI AKBAR", 400, 155);
      
      ctx.font = "normal 12px 'Times New Roman', Times, serif";
      ctx.fillStyle = "#555555";
      const printDateStr = new Date().toLocaleDateString("id-ID", {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      ctx.fillText(`Tanggal Cetak Dokumen: ${printDateStr}`, 400, 175);

      // 4. Financial Recap Data
      let inC = 0, outC = 0;
      window.STATE.finance.forEach((f) => {
        let v = Number(f.nominal) || 0;
        if (f.status.toLowerCase() === "pengeluaran") outC += v;
        else inC += v;
      });
      const saldo = inC - outC;

      // Recap Container Box
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(50, 200, 700, 70);
      
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.strokeRect(50, 200, 700, 70);
      
      // Divider Lines
      ctx.beginPath();
      ctx.moveTo(280, 200);
      ctx.lineTo(280, 270);
      ctx.moveTo(510, 200);
      ctx.lineTo(510, 270);
      ctx.stroke();
      
      // Column 1: Pemasukan
      ctx.fillStyle = "#475569";
      ctx.font = "bold 10px 'Times New Roman', Times, serif";
      ctx.textAlign = "left";
      ctx.fillText("REALISASI PEMASUKAN", 70, 225);
      ctx.fillStyle = "#15803d"; // Green
      ctx.font = "bold 18px 'Times New Roman', Times, serif";
      ctx.fillText(window.formatRupiah(inC), 70, 252);
      
      // Column 2: Pengeluaran
      ctx.fillStyle = "#475569";
      ctx.font = "bold 10px 'Times New Roman', Times, serif";
      ctx.fillText("REALISASI PENGELUARAN", 300, 225);
      ctx.fillStyle = "#b91c1c"; // Red
      ctx.font = "bold 18px 'Times New Roman', Times, serif";
      ctx.fillText(window.formatRupiah(outC), 300, 252);
      
      // Column 3: Saldo Kas
      ctx.fillStyle = "#475569";
      ctx.font = "bold 10px 'Times New Roman', Times, serif";
      ctx.fillText("SALDO KAS RIIL SAAT INI", 530, 225);
      ctx.fillStyle = "#1e293b"; // Dark Slate
      ctx.font = "bold 18px 'Times New Roman', Times, serif";
      ctx.fillText(window.formatRupiah(saldo), 530, 252);

      // 5. Transaction History Table
      ctx.fillStyle = "#000000";
      ctx.textAlign = "left";
      ctx.font = "bold 12px 'Times New Roman', Times, serif";
      ctx.fillText("Daftar Transaksi Terkini:", 50, 295);

      const startX = 50;
      const startY = 305;
      const rowHeight = 30;
      const cols = [
        { label: "No", width: 40, align: "center" },
        { label: "Tanggal", width: 90, align: "left" },
        { label: "Keterangan Transaksi", width: 260, align: "left" },
        { label: "Kategori", width: 110, align: "left" },
        { label: "Aliran", width: 70, align: "center" },
        { label: "Nominal", width: 130, align: "right" }
      ];

      // Draw Table Header
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(startX, startY, 700, 30);
      
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px 'Times New Roman', Times, serif";
      
      let curX = startX;
      cols.forEach(col => {
        let textX = curX;
        if (col.align === "center") {
          textX = curX + col.width / 2;
          ctx.textAlign = "center";
        } else if (col.align === "right") {
          textX = curX + col.width - 10;
          ctx.textAlign = "right";
        } else {
          textX = curX + 10;
          ctx.textAlign = "left";
        }
        ctx.fillText(col.label, textX, startY + 18);
        curX += col.width;
      });

      // Draw Rows (Last 8)
      const transactions = window.STATE.finance.slice(-8).reverse();
      let curY = startY + 30;

      transactions.forEach((t, index) => {
        ctx.fillStyle = index % 2 === 0 ? "#ffffff" : "#f8fafc";
        ctx.fillRect(startX, curY, 700, rowHeight);
        
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(startX, curY + rowHeight);
        ctx.lineTo(startX + 700, curY + rowHeight);
        ctx.stroke();
        
        ctx.font = "normal 11px 'Times New Roman', Times, serif";
        let cellX = startX;
        
        cols.forEach(col => {
          let textX = cellX;
          ctx.fillStyle = "#1e293b";
          
          if (col.align === "center") {
            textX = cellX + col.width / 2;
            ctx.textAlign = "center";
          } else if (col.align === "right") {
            textX = cellX + col.width - 10;
            ctx.textAlign = "right";
          } else {
            textX = cellX + 10;
            ctx.textAlign = "left";
          }
          
          let val = "";
          if (col.label === "No") {
            val = String(index + 1);
          } else if (col.label === "Tanggal") {
            val = String(t.tanggal || "-").split(",")[0];
          } else if (col.label === "Keterangan Transaksi") {
            val = (t.nama || t.keterangan || t.nama_pembayar || "-");
            if (val.length > 38) val = val.substring(0, 35) + "...";
          } else if (col.label === "Kategori") {
            val = (t.kategori || "-");
            if (val.length > 15) val = val.substring(0, 12) + "...";
          } else if (col.label === "Aliran") {
            val = t.status.toLowerCase() === "pengeluaran" ? "Keluar" : "Masuk";
            ctx.fillStyle = val === "Keluar" ? "#b91c1c" : "#15803d";
            ctx.font = "bold 11px 'Times New Roman', Times, serif";
          } else if (col.label === "Nominal") {
            val = window.formatRupiah(t.nominal);
            ctx.font = "bold 11px 'Times New Roman', Times, serif";
          }
          
          ctx.fillText(val, textX, curY + 18);
          cellX += col.width;
        });
        
        curY += rowHeight;
      });

      // 6. Committee Signatures Section
      const list = (window.STATE && window.STATE.panitia) ? window.STATE.panitia : [];
      let ketua = null;
      let sekretaris = null;
      let bendahara = null;

      list.forEach(p => {
          const jab = (p.jabatan || "").toLowerCase();
          if (jab.includes("ketua") && !ketua) {
              ketua = p;
          } else if (jab.includes("sekretaris") && !sekretaris) {
              sekretaris = p;
          } else if (jab.includes("bendahara") && !bendahara) {
              bendahara = p;
          }
      });

      const usedIds = new Set();
      if (ketua) usedIds.add(ketua.id);
      if (sekretaris) usedIds.add(sekretaris.id);
      if (bendahara) usedIds.add(bendahara.id);

      const unused = list.filter(p => !usedIds.has(p.id));
      if (!ketua && unused.length > 0) { ketua = unused.shift(); }
      if (!sekretaris && unused.length > 0) { sekretaris = unused.shift(); }
      if (!bendahara && unused.length > 0) { bendahara = unused.shift(); }

      const sigKetua = ketua || { nama: "", jabatan: "Ketua Panitia", tanda_tangan: null };
      const sigSekretaris = sekretaris || { nama: "", jabatan: "Sekretaris", tanda_tangan: null };
      const sigBendahara = bendahara || { nama: "", jabatan: "Bendahara", tanda_tangan: null };

      const leftSig = sigBendahara;
      const rightSig = sigKetua;

      ctx.fillStyle = "#000000";
      ctx.textAlign = "center";
      ctx.font = "normal 11px 'Times New Roman', Times, serif";
      ctx.fillText("Hormat kami,", 400, 615);
      
      ctx.font = "bold 11px 'Times New Roman', Times, serif";
      ctx.fillText("PANITIA PELAKSANA REUNI AKBAR AL-FATAH", 400, 630);
      
      const sigY = 660;
      
      // Left Signature (Bendahara)
      ctx.font = "bold 11px 'Times New Roman', Times, serif";
      ctx.fillText(leftSig.jabatan || "Bendahara,", 200, sigY);
      
      if (leftSig.tanda_tangan) {
        const leftSigImg = await loadImg(leftSig.tanda_tangan);
        if (leftSigImg) {
          ctx.drawImage(leftSigImg, 130, sigY + 5, 140, 63);
        }
      }
      
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(100, sigY + 75);
      ctx.lineTo(300, sigY + 75);
      ctx.stroke();
      
      ctx.font = "normal 11px 'Times New Roman', Times, serif";
      ctx.fillText(leftSig.nama ? `( ${leftSig.nama} )` : "( ____________________ )", 200, sigY + 92);
      
      // Right Signature (Ketua)
      ctx.font = "bold 11px 'Times New Roman', Times, serif";
      ctx.fillText("Mengetahui,", 600, sigY - 15);
      ctx.fillText(rightSig.jabatan || "Ketua Panitia,", 600, sigY);
      
      if (rightSig.tanda_tangan) {
        const rightSigImg = await loadImg(rightSig.tanda_tangan);
        if (rightSigImg) {
          ctx.drawImage(rightSigImg, 530, sigY + 5, 140, 63);
        }
      }
      
      ctx.beginPath();
      ctx.moveTo(500, sigY + 75);
      ctx.lineTo(700, sigY + 75);
      ctx.stroke();
      
      ctx.fillText(rightSig.nama ? `( ${rightSig.nama} )` : "( ____________________ )", 600, sigY + 92);

      // 7. Security Footer Section
      ctx.fillStyle = "#64748b";
      ctx.font = "italic 10px 'Times New Roman', Times, serif";
      ctx.textAlign = "center";
      ctx.fillText("Laporan Resmi Terintegrasi dihasilkan langsung secara real-time oleh Portal Reuni Al-Fatah.", 400, 890);
      ctx.fillText("Seluruh riwayat keuangan telah tercatat permanen pada sistem ledger keuangan.", 400, 905);

      fileBlob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      fileName = "Laporan_Keuangan_Reuni.png";
    }
    return { fileBlob, fileName };
  };


  // --- Extracted from app.js (window.exportOfficialLPJPDF) ---
window.exportOfficialLPJPDF = async () => {
    window.toggleLoading(true, "Membuat LPJ Resmi Al-Fatah...");
    try {
        await window._loadJsPDF();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF("p", "mm", "a4");
        
        // A4 size: 210 x 297 mm
        
        // 1. KOP SURAT RESMI (Official Header)
        try {
            const logoImg = await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = "img/logo.png";
            });
            if (logoImg) {
                doc.addImage(logoImg, "PNG", 18, 11, 16, 16);
            }
        } catch (logoErr) {
            console.error("Failed to load logo in PDF:", logoErr);
        }

        doc.setFont("times", "bold");
        doc.setFontSize(14);
        doc.text("ALUMNI PONDOK PESANTREN", 112, 16, { align: "center" });
        doc.text("AL-FATAH TEGALWARU PURWAKARTA", 112, 21, { align: "center" });
        
        doc.setFont("times", "italic");
        doc.setFontSize(10);
        doc.text("Jl. BBI Cirata Kp. Cilangkap Rt. 10 Rw.05 Cadassari Tegalwaru Purwakarta 41165", 112, 26, { align: "center" });

        
        // Decorative double lines below Kop Surat
        doc.setLineWidth(0.8);
        doc.setDrawColor(0, 0, 0);
        doc.line(15, 30, 195, 30);
        doc.setLineWidth(0.2);
        doc.line(15, 31, 195, 31);
        
        // 2. JUDUL DOKUMEN (Document Title)
        doc.setFont("times", "bold");
        doc.setFontSize(12);
        doc.text("LAPORAN PERTANGGUNGJAWABAN (LPJ) KEUANGAN REUNI AKBAR", 105, 40, { align: "center" });
        doc.setFont("times", "normal");
        doc.setFontSize(10);
        doc.text(`Tanggal Cetak Dokumen: ${new Date().toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 105, 45, { align: "center" });
        
        // 3. PENGANTAR / RINGKASAN LPJ (Introduction)
        let startY = 55;
        doc.setFont("times", "bold");
        doc.text("I. PENDAHULUAN & KATA PENGANTAR", 15, startY);
        
        doc.setFont("times", "normal");
        startY += 5;
        const introText = "Segala puji bagi Allah SWT atas karunia-Nya yang telah memperkenankan terwujudnya kegiatan Reuni Akbar Alumni Pesantren Al-Fatah. Laporan Pertanggungjawaban (LPJ) Keuangan ini disusun secara jujur, transparan, dan dapat dipertanggungjawabkan untuk memberikan gambaran kas riil kepada seluruh alumni, panitia, serta jajaran pengasuh Pondok Pesantren Al-Fatah.";
        const splitIntro = doc.splitTextToSize(introText, 180);
        doc.text(splitIntro, 15, startY);
        
        startY += splitIntro.length * 4.5 + 5;
        
        // 4. REKAPITULASI KAS & ANGGARAN (Summary Cards)
        doc.setFont("times", "bold");
        doc.text("II. RINGKASAN (REKAPITULASI) REALISASI DANA", 15, startY);
        
        // Calculate stats
        let totalPemasukan = 0;
        let totalPengeluaran = 0;
        window.STATE.finance.forEach(f => {
            const v = Number(f.nominal) || 0;
            if (f.status.toLowerCase() === "pemasukan") totalPemasukan += v;
            else if (f.status.toLowerCase() === "pengeluaran") totalPengeluaran += v;
        });
        const saldoKas = totalPemasukan - totalPengeluaran;
        
        let totalRab = 0;
        window.STATE.rab.forEach(r => {
            totalRab += Number(r.nominal || r.biaya || 0);
        });
        const selisihRAB = totalRab - totalPemasukan;
        const persenComplete = totalRab > 0 ? ((totalPemasukan / totalRab) * 100).toFixed(1) : 100;
        
        // Draw Rekapitulasi Table or Block
        startY += 4;
        doc.setFont("times", "normal");
        doc.setFillColor(245, 247, 250);
        doc.rect(15, startY, 180, 26, "F");
        doc.setDrawColor(200, 200, 200);
        doc.rect(15, startY, 180, 26, "S");
        
        doc.setFont("times", "bold");
        doc.text("Realisasi Pemasukan Kas :", 20, startY + 6);
        doc.setFont("times", "normal");
        doc.text(window.formatRupiah(totalPemasukan), 100, startY + 6, { align: "right" });
        
        doc.setFont("times", "bold");
        doc.text("Realisasi Pengeluaran Kas:", 20, startY + 12);
        doc.setFont("times", "normal");
        doc.text(window.formatRupiah(totalPengeluaran), 100, startY + 12, { align: "right" });
        
        doc.setFont("times", "bold");
        doc.text("Saldo Kas Riil Saat Ini :", 20, startY + 18);
        doc.text(window.formatRupiah(saldoKas), 100, startY + 18, { align: "right" });
        
        doc.setFont("times", "bold");
        doc.text("Target Anggaran (RAB)  :", 110, startY + 6);
        doc.setFont("times", "normal");
        doc.text(window.formatRupiah(totalRab), 190, startY + 6, { align: "right" });
        
        doc.setFont("times", "bold");
        doc.text("Persentase Ketercapaian  :", 110, startY + 12);
        doc.setFont("times", "normal");
        doc.text(`${persenComplete}%`, 190, startY + 12, { align: "right" });
        
        doc.setFont("times", "bold");
        doc.text("Status Proyeksi LPJ       :", 110, startY + 18);
        doc.setFont("times", "bold");
        if (selisihRAB > 0) {
            doc.setTextColor(200, 0, 0);
            doc.text(`Kekurangan ${window.formatRupiah(selisihRAB)}`, 190, startY + 18, { align: "right" });
        } else {
            doc.setTextColor(0, 100, 0);
            doc.text("Surplus / Cukup", 190, startY + 18, { align: "right" });
        }
        doc.setTextColor(0, 0, 0); // reset
        
        startY += 32;
        
        // 5. RINCIAN ALIRAN DANA KAS (Table)
        doc.setFont("times", "bold");
        doc.text("III. RINCIAN BUKU KAS PERTANGGUNGJAWABAN", 15, startY);
        
        startY += 4;
        
        const tableBody = window.STATE.finance.map((f, i) => [
            i + 1,
            String(f.tanggal || "-").split(",")[0],
            f.nama || f.keterangan || f.nama_pembayar || "-",
            f.kategori || "-",
            f.status.toLowerCase() === "pengeluaran" ? "Keluar" : "Masuk",
            window.formatRupiah(f.nominal)
        ]);
        
        doc.autoTable({
            startY: startY,
            head: [["No", "Tanggal", "Keterangan Transaksi", "Kategori", "Aliran", "Nominal"]],
            body: tableBody,
            styles: { font: "times", fontSize: 9, cellPadding: 2 },
            headStyles: { fillColor: [15, 23, 42], fontStyle: "bold" }, // Formal Dark Navy
            columnStyles: {
                0: { cellWidth: 10, halign: "center" },
                1: { cellWidth: 25 },
                2: { cellWidth: 70 },
                3: { cellWidth: 30 },
                4: { cellWidth: 20, halign: "center" },
                5: { cellWidth: 25, halign: "right" }
            },
            didParseCell: function (data) {
                if (data.section === "body" && data.column.index === 4) {
                    data.cell.styles.textColor = data.cell.text[0] === "Keluar" ? [180, 0, 0] : [0, 100, 0];
                    data.cell.styles.fontStyle = "bold";
                }
            }
        });
        
        // Get Y position after table to print signature block (LPJ Signatures)
        let finalY = doc.lastAutoTable.finalY + 15;
        if (finalY > 220) { // If too close to bottom, add new page
            doc.addPage();
            finalY = 30;
        }
        
        // 6. TANDA TANGAN PANITIA (Signature Block)
        doc.setFont("times", "normal");
        doc.setFontSize(10);
        doc.text("Hormat kami,", 105, finalY, { align: "center" });
        doc.setFont("times", "bold");
        doc.text("PANITIA PELAKSANA REUNI AKBAR AL-FATAH", 105, finalY + 5, { align: "center" });
        
        finalY += 15;
        
        drawCommitteeSignatures(doc, finalY, "finance");
        
        await window.savePDF(doc, "LPJ_Keuangan_Resmi_AlFatah.pdf");
        window.notify("Laporan LPJ Resmi Keuangan berhasil dibuat & diunduh!", "success");
    } catch (err) {
        console.error(err);
        window.notify("Gagal membuat laporan LPJ Resmi: " + err.message, "error");
    } finally {
        window.toggleLoading(false);
    }
};

window.generateDigitalInvitation = async (nama, angkatan, canvasEl) => {
    const ctx = canvasEl.getContext("2d");
    
    // Set high resolution
    canvasEl.width = 800;
    canvasEl.height = 1200;
    
    // 1. Background Gradient (Dark Mode Cosmic Theme)
    const bgGrad = ctx.createLinearGradient(0, 0, 800, 1200);
    bgGrad.addColorStop(0, "#080b18");
    bgGrad.addColorStop(0.5, "#0f132e");
    bgGrad.addColorStop(1, "#170f28");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 800, 1200);
    
    // 2. Cosmic Ambient Glow
    const radialGlow = ctx.createRadialGradient(400, 600, 50, 400, 600, 500);
    radialGlow.addColorStop(0, "rgba(99, 102, 241, 0.15)"); // Neon Indigo
    radialGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = radialGlow;
    ctx.fillRect(0, 0, 800, 1200);
    
    // Accent Emerald Glow at bottom
    const radialGlow2 = ctx.createRadialGradient(400, 1100, 50, 400, 1100, 300);
    radialGlow2.addColorStop(0, "rgba(16, 185, 129, 0.12)"); // Neon Emerald
    radialGlow2.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = radialGlow2;
    ctx.fillRect(0, 0, 800, 1200);

    // 3. Neon Borders
    ctx.strokeStyle = "rgba(99, 102, 241, 0.3)";
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 760, 1160);
    
    ctx.strokeStyle = "rgba(16, 185, 129, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(28, 28, 744, 1144);

    // Draw Corner Accents
    ctx.fillStyle = "rgba(16, 185, 129, 0.6)";
    // Top-Left
    ctx.fillRect(20, 20, 40, 6);
    ctx.fillRect(20, 20, 6, 40);
    // Top-Right
    ctx.fillRect(740, 20, 40, 6);
    ctx.fillRect(774, 20, 6, 40);
    // Bottom-Left
    ctx.fillRect(20, 1174, 40, 6);
    ctx.fillRect(20, 1140, 6, 40);
    // Bottom-Right
    ctx.fillRect(740, 1174, 40, 6);
    ctx.fillRect(774, 1140, 6, 40);

    // 4. Logo Al-Fatah
    try {
        const logoImg = await new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = "img/logo.png";
        });
        if (logoImg) {
            ctx.drawImage(logoImg, 350, 80, 100, 100);
        }
    } catch (e) {
        console.error("Gagal memuat logo untuk undangan:", e);
    }

    // 5. Header Texts
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("ALUMNI PONDOK PESANTREN AL-FATAH", 400, 220);
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Cadassari, Tegalwaru, Purwakarta", 400, 240);

    // 6. Main Title
    const titleGrad = ctx.createLinearGradient(0, 280, 0, 380);
    titleGrad.addColorStop(0, "#f59e0b"); // Gold Amber
    titleGrad.addColorStop(1, "#d97706");
    ctx.fillStyle = titleGrad;
    ctx.font = "black 42px sans-serif";
    ctx.fillText("UNDANGAN RESMI", 400, 310);
    
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("REUNI AKBAR ALUMNI", 400, 360);

    // Decorative divider line
    const divGrad = ctx.createLinearGradient(200, 0, 600, 0);
    divGrad.addColorStop(0, "rgba(99, 102, 241, 0)");
    divGrad.addColorStop(0.5, "rgba(99, 102, 241, 0.8)");
    divGrad.addColorStop(1, "rgba(99, 102, 241, 0)");
    ctx.fillStyle = divGrad;
    ctx.fillRect(200, 390, 400, 2);

    // 7. Recipient Box (Glassmorphism Effect)
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.fillRect(80, 430, 640, 180);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(80, 430, 640, 180);

    ctx.fillStyle = "rgba(16, 185, 129, 0.7)";
    ctx.font = "italic 16px sans-serif";
    ctx.fillText("Kepada Yang Terhormat Rekan/i:", 400, 470);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px sans-serif";
    ctx.fillText(nama, 400, 520);

    ctx.fillStyle = "#818cf8";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(`Angkatan / Alumni Tahun: ${angkatan || "-"}`, 400, 565);

    // 8. Event Details Block
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "16px sans-serif";
    ctx.fillText("Mengharap kehadiran Kakak pada acara silaturahmi akbar:", 400, 660);

    // Detail Box
    ctx.fillStyle = "rgba(99, 102, 241, 0.05)";
    ctx.fillRect(100, 690, 600, 150);
    ctx.strokeStyle = "rgba(99, 102, 241, 0.15)";
    ctx.strokeRect(100, 690, 600, 150);

    // Event Date & Place
    const evDate = window.STATE && window.STATE.eventDate !== "TBD" ? window.STATE.eventDate : "Ahad, 14 Juni 2026";
    const evTime = window.STATE && window.STATE.eventTime ? window.STATE.eventTime : "08:00 WIB s/d Selesai";
    const evGuest = window.STATE && window.STATE.eventGuest ? window.STATE.eventGuest : "K.H. Anwar Zahid (Sidoarjo)";

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(`Hari, Tanggal : ${evDate}`, 400, 730);
    ctx.font = "16px sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(`Waktu : ${evTime}`, 400, 765);
    ctx.fillText("Tempat : Kompleks Utama Pondok Pesantren Al-Fatah", 400, 800);

    // Mauidhoh Hasanah / Pembicara
    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold italic 15px sans-serif";
    ctx.fillText(`Muballigh: ${evGuest}`, 400, 885);

    // 9. QR Code Section for Presensi
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "12px sans-serif";
    ctx.fillText("Pindai QR Code di bawah saat memasuki lokasi acara:", 400, 935);

    // QR Code generation & draw
    try {
        const tempDiv = document.createElement("div");
        document.body.appendChild(tempDiv);
        const qrContent = `alumni_ticket:${nama}|${angkatan}`;
        new QRCode(tempDiv, {
            text: qrContent,
            width: 140,
            height: 140,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });
        
        await new Promise(r => setTimeout(r, 100)); // wait for QR code to render
        const qrImg = tempDiv.querySelector("img");
        if (qrImg && qrImg.src) {
            const qrCanvasImage = await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = qrImg.src;
            });
            if (qrCanvasImage) {
                // Background white box for QR Code
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(320, 960, 160, 160);
                ctx.drawImage(qrCanvasImage, 330, 970, 140, 140);
            }
        }
        document.body.removeChild(tempDiv);
    } catch (qrErr) {
        console.error("Gagal menggambar QR Code pada undangan:", qrErr);
    }

    ctx.fillStyle = "#475569";
    ctx.font = "italic 11px sans-serif";
    ctx.fillText("Harap membawa undangan digital ini untuk kelancaran registrasi.", 400, 1150);
};

window.sendDigitalInvitationWA = async (nama, nowa, angkatan) => {
    window.toggleLoading(true, "Menyiapkan Undangan...");
    try {
        const canvas = document.createElement("canvas");
        await window.generateDigitalInvitation(nama, angkatan, canvas);
        
        window.toggleLoading(true, "Mengompresi Gambar...");
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.75));
        
        window.toggleLoading(true, "Mengunggah Kartu Undangan...");
        const formData = new FormData();
        formData.append("file", blob);
        formData.append("upload_preset", "Reuniakbar");
        
        const cloudRes = await fetch("https://api.cloudinary.com/v1_1/dowih3wr7/image/upload", {
            method: "POST",
            body: formData
        });
        const cloudData = await cloudRes.json();
        
        if (!cloudData.secure_url) {
            throw new Error("Gagal mengunggah gambar ke Cloudinary.");
        }
        
        const imageUrl = cloudData.secure_url;
        const msgText = `*PONDOK PESANTREN AL-FATAH TEGALWARU PURWAKARTA*\n\n_Assalamu'alaikum Wr. Wb._\n\nDengan hormat, kami mengharap kehadiran Rekan/i *${nama}* (Alumni Angkatan *${angkatan || '-'}*) untuk menghadiri acara *Reuni Akbar Alumni Pesantren Al-Fatah*.\n\nBerikut kami lampirkan *Undangan Resmi* beserta E-Tiket QR Code pribadi Kakak.\n\nSampai jumpa di lokasi acara silaturahmi!\n\n_Wassalamu'alaikum Wr. Wb._`;
        
        window.toggleLoading(true, "Mengirim via WhatsApp...");
        await window.sendWhatsAppInternal(window.normalizePhoneNumber(nowa), msgText, imageUrl, 'broadcast');
        window.notify(`Undangan resmi berhasil dikirim ke ${nama}!`, "success");
    } catch (err) {
        console.error(err);
        window.notify("Gagal mengirim undangan: " + err.message, "error");
    } finally {
        window.toggleLoading(false);
    }
};

window.openInvitationPreview = async (nama, nowa, angkatan) => {
    window.openModal("modal-invitation-preview");
    
    const canvas = document.getElementById("invitation-preview-canvas");
    if (!canvas) return;
    
    // Setup temporary text drawing while rendering
    const ctx = canvas.getContext("2d");
    canvas.width = 400;
    canvas.height = 600;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, 400, 600);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Menggambar Undangan...", 200, 300);
    
    // Draw high-resolution canvas in background
    setTimeout(async () => {
        try {
            await window.generateDigitalInvitation(nama, angkatan, canvas);
        } catch (err) {
            console.error("Gagal generate pratinjau undangan:", err);
            window.notify("Gagal memuat pratinjau", "error");
        }
    }, 150);
    
    // Bind download
    const btnDownload = document.getElementById("btn-download-invitation");
    if (btnDownload) {
        btnDownload.onclick = () => {
            const link = document.createElement("a");
            link.download = `Undangan_${nama}.jpg`;
            link.href = canvas.toDataURL("image/jpeg", 0.9);
            link.click();
            window.notify("Gambar undangan berhasil diunduh!", "success");
        };
    }
    
    // Bind send WA
    const btnSendWA = document.getElementById("btn-send-invitation-wa");
    if (btnSendWA) {
        btnSendWA.onclick = async () => {
            await window.sendDigitalInvitationWA(nama, nowa, angkatan);
            window.closeModal("modal-invitation-preview");
        };
    }
};

window.exportSuratPDF = async () => {
  window.toggleLoading(true, "Membuat Laporan Distribusi Surat PDF...");
  try {
      await window._loadJsPDF();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF("p", "mm", "a4");
      
      // 1. KOP SURAT RESMI (Official Header)
      try {
        const logoImg = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = "img/logo.png";
        });
        if (logoImg) {
          doc.addImage(logoImg, "PNG", 18, 11, 16, 16);
        }
      } catch (logoErr) {
        console.error("Failed to load logo in PDF:", logoErr);
      }

      doc.setFont("times", "bold");
      doc.setFontSize(14);
      doc.text("ALUMNI PONDOK PESANTREN", 112, 16, { align: "center" });
      doc.text("AL-FATAH TEGALWARU PURWAKARTA", 112, 21, { align: "center" });
      
      doc.setFont("times", "italic");
      doc.setFontSize(10);
      doc.text("Jl. BBI Cirata Kp. Cilangkap Rt. 10 Rw.05 Cadassari Tegalwaru Purwakarta 41165", 112, 26, { align: "center" });
      
      // Decorative double lines
      doc.setLineWidth(0.8);
      doc.setDrawColor(0, 0, 0);
      doc.line(15, 30, 195, 30);
      doc.setLineWidth(0.2);
      doc.line(15, 31, 195, 31);
      
      // 2. JUDUL DOKUMEN & SUBTITLE (Filter)
      doc.setFont("times", "bold");
      doc.setFontSize(12);
      doc.text("LAPORAN DATA DISTRIBUSI SURAT ALUMNI", 105, 38, { align: "center" });
      
      // Get active filters
      const kab = document.getElementById("filter-surat-kab")?.value || "";
      const kec = document.getElementById("filter-surat-kec")?.value || "";
      const des = document.getElementById("filter-surat-desa")?.value || "";
      const status = document.getElementById("filter-surat-status")?.value || "";
      const searchVal = document.getElementById("search-surat-input")?.value || "";
      
      let filterParts = [];
      if (kab) filterParts.push(`Kab. ${kab}`);
      if (kec) filterParts.push(`Kec. ${kec}`);
      if (des) filterParts.push(`Desa ${des}`);
      if (status) filterParts.push(`Status: ${status === 'sudah' ? 'Sudah Diterima' : 'Belum Diterima'}`);
      if (searchVal) filterParts.push(`Cari: "${searchVal}"`);
      
      const filterText = filterParts.length > 0 ? filterParts.join(", ") : "Semua Data";
      
      doc.setFont("times", "bolditalic");
      doc.setFontSize(9.5);
      doc.text(`Kriteria: ${filterText}`, 105, 43, { align: "center" });
      
      doc.setFont("times", "normal");
      doc.text(`Tanggal Cetak Dokumen: ${new Date().toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 105, 48, { align: "center" });
      
      // 3. TABLE DATA SURAT
      const dataToExport = window.filteredSuratData || [];
      if (dataToExport.length === 0) {
        window.notify("Tidak ada data untuk diekspor", "warning");
        return;
      }
      
      doc.autoTable({
        startY: 53,
        head: [["No", "Nama Alumni", "Angkatan", "Lembaga", "Alamat Lengkap", "No. WhatsApp", "Status Surat"]],
        body: dataToExport.map((a, i) => {
          const addressStr = [a.alamat, a.desa, a.kecamatan, a.kabupaten].filter(Boolean).join(", ");
          return [
            i + 1,
            a.nama || "-",
            a.angkatan || "-",
            a.lembaga || "-",
            addressStr || "-",
            a.nowa || "-",
            a.status_surat === "sudah" ? "Sudah Diterima" : "Belum Diterima",
          ];
        }),
        styles: { font: "times", fontSize: 8.5, cellPadding: 2.5 },
        headStyles: { fillColor: [15, 23, 42], fontStyle: "bold" },
        columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            1: { cellWidth: 38 },
            2: { cellWidth: 16, halign: "center" },
            3: { cellWidth: 16, halign: "center" },
            4: { cellWidth: 48 },
            5: { cellWidth: 26 },
            6: { cellWidth: 26, halign: "center" }
        },
        didParseCell: function (data) {
            if (data.section === "body" && data.column.index === 6) {
                data.cell.styles.textColor = data.cell.text[0] === "Belum Diterima" ? [180, 0, 0] : [0, 100, 0];
                data.cell.styles.fontStyle = "bold";
            }
        }
      });

      // 4. SIGNATURES
      let finalY = doc.lastAutoTable.finalY + 15;
      if (finalY > 220) {
          doc.addPage();
          finalY = 30;
      }
      
      doc.setFont("times", "normal");
      doc.setFontSize(10);
      doc.text("Hormat kami,", 105, finalY, { align: "center" });
      doc.setFont("times", "bold");
      doc.text("PANITIA PELAKSANA REUNI AKBAR AL-FATAH", 105, finalY + 5, { align: "center" });
      
      finalY += 15;
      
      drawCommitteeSignatures(doc, finalY, "data");

      // Construct dynamic file name
      let suffix = "";
      if (kab) suffix += `_${kab}`;
      if (kec) suffix += `_${kec}`;
      if (des) suffix += `_${des}`;
      if (status) suffix += `_${status}`;
      if (searchVal) suffix += `_Cari_${searchVal}`;
      suffix = suffix.replace(/[^a-zA-Z0-9_\-\s]/g, "").trim().replace(/\s+/g, "_");

      const pdfFileName = suffix ? `Laporan_Distribusi_Surat${suffix}.pdf` : "Laporan_Distribusi_Surat.pdf";
      await window.savePDF(doc, pdfFileName);
      
  } catch (err) {
      console.error(err);
      window.notify("Gagal membuat laporan PDF", "error");
  } finally {
      window.toggleLoading(false);
  }
};

})();

