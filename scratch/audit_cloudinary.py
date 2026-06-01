import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"c:\Users\Ahmad\Downloads\alumni web\js\app.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Check Cloudinary config in app.js - how many upload endpoints exist
print("=== TITIK UPLOAD CLOUDINARY di app.js ===")
for i, line in enumerate(lines, 1):
    if "cloudinary" in line.lower() or "upload_preset" in line.lower() or "dowih3wr7" in line:
        print(f"  {i}: {line.strip()[:100]}")

print("\n=== TITIK UPLOAD DI pembayaran.html ===")
with open(r"c:\Users\Ahmad\Downloads\alumni web\pembayaran.html", "r", encoding="utf-8") as f:
    plines = f.readlines()
for i, line in enumerate(plines, 1):
    if "cloudinary" in line.lower() or "upload_preset" in line.lower():
        print(f"  {i}: {line.strip()[:100]}")

print("\n=== TITIK UPLOAD DI cek-status.html ===")
with open(r"c:\Users\Ahmad\Downloads\alumni web\cek-status.html", "r", encoding="utf-8") as f:
    clines = f.readlines()
for i, line in enumerate(clines, 1):
    if "cloudinary" in line.lower() or "upload_preset" in line.lower():
        print(f"  {i}: {line.strip()[:100]}")
