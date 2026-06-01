import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"c:\Users\Ahmad\Downloads\alumni web\js\app.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

print("=== SEMUA console.log di app.js ===")
for i, line in enumerate(lines, 1):
    if "console.log" in line:
        print(f"  {i}: {line.rstrip()}")
