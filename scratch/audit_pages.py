import sys
sys.stdout.reconfigure(encoding='utf-8')

# Check what pages exist and their sizes
import os

pages = [
    r"c:\Users\Ahmad\Downloads\alumni web\index.html",
    r"c:\Users\Ahmad\Downloads\alumni web\pembayaran.html",
    r"c:\Users\Ahmad\Downloads\alumni web\pendaftaran.html",
    r"c:\Users\Ahmad\Downloads\alumni web\cek-status.html",
    r"c:\Users\Ahmad\Downloads\alumni web\login.html",
    r"c:\Users\Ahmad\Downloads\alumni web\Rundown.html",
    r"c:\Users\Ahmad\Downloads\alumni web\surat-undangan.html",
    r"c:\Users\Ahmad\Downloads\alumni web\countdown.html",
]

for p in pages:
    if os.path.exists(p):
        size_kb = os.path.getsize(p) // 1024
        with open(p, "r", encoding="utf-8") as f:
            lines = len(f.readlines())
        print(f"{os.path.basename(p):30s}: {size_kb:5d} KB  ({lines} baris)")
