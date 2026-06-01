import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"c:\Users\Ahmad\Downloads\alumni web\js\app.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx in range(9600, 9760):
    if idx <= len(lines):
        print(f"{idx}: {lines[idx - 1]}", end="")
