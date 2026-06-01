import re

with open(r"c:\Users\Ahmad\Downloads\alumni web\pembayaran.html", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "bukti_url" in line or "bukti_hash" in line or "finance" in line or "cloudinary" in line or "upload" in line:
        if len(line.strip()) < 150:
            print(f"{i}: {line.strip()}")
