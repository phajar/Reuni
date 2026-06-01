import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"c:\Users\Ahmad\Downloads\alumni web\pembayaran.html", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx in range(1010, 1070):
    if idx <= len(lines):
        print(f"{idx}: {lines[idx - 1]}", end="")
