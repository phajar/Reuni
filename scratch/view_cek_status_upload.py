import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"c:\Users\Ahmad\Downloads\alumni web\cek-status.html", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx in range(370, 425):
    if idx <= len(lines):
        print(f"{idx}: {lines[idx - 1]}", end="")
