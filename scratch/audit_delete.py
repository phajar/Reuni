import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"c:\Users\Ahmad\Downloads\alumni web\js\app.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Check how role/permission is validated on delete/edit operations
print("=== OPERASI DELETE (Hapus Data) ===")
for i, line in enumerate(lines, 1):
    if ".delete(" in line.lower() or "deleteDoc" in line:
        # Print surrounding context
        start = max(0, i-4)
        end = min(len(lines), i+2)
        for j in range(start, end):
            marker = ">>>" if j == i-1 else "   "
            print(f"  {marker} {j+1}: {lines[j].strip()[:100]}")
        print()
